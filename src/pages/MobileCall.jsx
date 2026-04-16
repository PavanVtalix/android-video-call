import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket, joinRoom } from "../services/socket";
import { createPeerConnection } from "../webrtc/peer";
import Controls from "../components/Controls";
import ChatDrawer from "../components/ChatDrawer";
import CallFeedbackModal from "../components/CallFeedbackModal";
import CallNoticeModal from "../components/CallNoticeModal";
import micOff from "../assets/Microphone off.svg";
import videoOffIcon from "../assets/Video off.svg";
import "../styles/mobile-call.css";

function getAppointmentApiBaseUrl() {
  return (
    import.meta.env.VITE_BACKEND_URL_APPOINTMENT_PUBLIC ||
    import.meta.env.VITE_BACKEND_URL_APPOINTMENT ||
    ""
  );
}

async function fetchPublicVideoSession(appointmentId) {
  const baseUrl = getAppointmentApiBaseUrl();
  if (!baseUrl || !appointmentId) {
    return null;
  }

  const response = await fetch(`${baseUrl}/video-session/${appointmentId}`);
  if (!response.ok) {
    throw new Error("Unable to fetch video session");
  }

  const payload = await response.json();
  return payload?.data?.data || payload?.data || null;
}

async function submitPublicVideoFeedback(appointmentId, payload) {
  const baseUrl = getAppointmentApiBaseUrl();
  if (!baseUrl || !appointmentId) {
    throw new Error("Missing appointment API URL");
  }

  const response = await fetch(`${baseUrl}/video-session/${appointmentId}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Unable to submit video feedback");
  }

  const data = await response.json();
  return data?.data || null;
}

function buildAppReturnUrl({ appointmentId, roomId, socketId }) {
  const baseUrl = import.meta.env.VITE_APP_RETURN_URL || "vtalix://video-call-ended";

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("appointmentId", appointmentId || "");
    url.searchParams.set("roomId", roomId || "");
    url.searchParams.set("socketId", socketId || "");
    url.searchParams.set("status", "ended");
    return url.toString();
  } catch (_error) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}appointmentId=${encodeURIComponent(appointmentId || "")}&roomId=${encodeURIComponent(roomId || "")}&socketId=${encodeURIComponent(socketId || "")}&status=ended`;
  }
}

function notifyHostApp(payload) {
  const serializedPayload = JSON.stringify(payload);

  try {
    if (window.flutter_inappwebview?.callHandler) {
      window.flutter_inappwebview.callHandler("videoCallEnded", payload);
    }
  } catch (error) {
    console.warn("flutter_inappwebview handler failed", error);
  }

  try {
    if (window.VideoCallChannel?.postMessage) {
      window.VideoCallChannel.postMessage(serializedPayload);
    }
  } catch (error) {
    console.warn("VideoCallChannel postMessage failed", error);
  }

  try {
    if (window.VtalixBridge?.postMessage) {
      window.VtalixBridge.postMessage(serializedPayload);
    }
  } catch (error) {
    console.warn("VtalixBridge postMessage failed", error);
  }

  try {
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(serializedPayload);
    }
  } catch (error) {
    console.warn("ReactNativeWebView postMessage failed", error);
  }

  try {
    window.dispatchEvent(new CustomEvent("vtalix:video-call-ended", { detail: payload }));
  } catch (error) {
    console.warn("Custom event dispatch failed", error);
  }
}

function getParticipantId(roomId) {
  const storageKey = `patient-call:${roomId}:participant`;
  const existingId = localStorage.getItem(storageKey);

  if (existingId) {
    return existingId;
  }

  const createdId = `patient-${roomId}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(storageKey, createdId);
  return createdId;
}

function getParticipantName(roomId) {
  const storageKey = `patient-call:${roomId}:name`;
  const existingName = localStorage.getItem(storageKey);

  if (existingName) {
    return existingName;
  }

  const createdName = "Patient";
  localStorage.setItem(storageKey, createdName);
  return createdName;
}

export default function MobileCall() {
  const { appointmentId, roomId, socketId } = useParams();
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const allowExitRef = useRef(false);
  const chatOpenRef = useRef(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [messages, setMessages] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [callStatus, setCallStatus] = useState("Connecting");
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const navigate = useNavigate();
  const participantId = useMemo(() => getParticipantId(roomId), [roomId]);
  const participantName = useMemo(() => getParticipantName(roomId), [roomId]);
  const reminderShownRef = useRef(false);
  const feedbackShownRef = useRef(false);
  const feedbackSubmittedRef = useRef(false);
  const pendingEndCallRef = useRef(false);

  useEffect(() => {
    if (!appointmentId) {
      return;
    }

    let active = true;

    const loadSessionMeta = async () => {
      try {
        const session = await fetchPublicVideoSession(appointmentId);
        if (!active || !session) {
          return;
        }

        setSessionMeta(session);
        feedbackSubmittedRef.current = session.patientRating != null;
      } catch (error) {
        console.warn("Unable to fetch public video session", error);
      }
    };

    loadSessionMeta();

    return () => {
      active = false;
    };
  }, [appointmentId]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;

    if (chatOpen) {
      setUnreadChatCount(0);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!sessionMeta?.scheduledStartAt) {
      return;
    }

    const runTimingChecks = () => {
      const startAt = new Date(sessionMeta.scheduledStartAt).getTime();
      const endAt = sessionMeta.scheduledEndAt
        ? new Date(sessionMeta.scheduledEndAt).getTime()
        : startAt + 60 * 60 * 1000;
      const now = Date.now();
      const reminderAt = startAt + 45 * 60 * 1000;
      const feedbackAt = endAt - 60 * 1000;

      if (!reminderShownRef.current && now >= reminderAt && now < endAt) {
        reminderShownRef.current = true;
        setReminderOpen(true);
      }

      if (!feedbackShownRef.current && !feedbackSubmittedRef.current && now >= feedbackAt) {
        feedbackShownRef.current = true;
        setFeedbackOpen(true);
      }
    };

    runTimingChecks();
    const intervalId = window.setInterval(runTimingChecks, 30000);
    return () => window.clearInterval(intervalId);
  }, [sessionMeta]);

  useEffect(() => {
    let isMounted = true;

    const clearRemoteMedia = () => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = null;
      }
      setRemoteConnected(false);
      remoteSocketIdRef.current = null;
      pendingCandidatesRef.current = [];
    };

    const cleanupPeer = () => {
      if (peerRef.current) {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
      }
      peerRef.current = null;
      clearRemoteMedia();
    };

    const flushCandidates = async () => {
      const peer = peerRef.current;
      if (!peer?.remoteDescription) {
        return;
      }

      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        await peer.addIceCandidate(candidate);
      }
    };

    const emitOffer = async (iceRestart = false) => {
      const peer = peerRef.current;
      const remoteSocketId = remoteSocketIdRef.current;
      if (!peer || !remoteSocketId) {
        return;
      }

      const offer = await peer.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await peer.setLocalDescription(offer);
      socket.emit("offer", { offer, to: remoteSocketId });
    };

    const createManagedPeer = (remoteSocketId) => {
      cleanupPeer();
      remoteSocketIdRef.current = remoteSocketId;

      const peer = createPeerConnection(
        streamRef.current,
        (remoteStream) => {
          if (remoteRef.current) {
            remoteRef.current.srcObject = remoteStream;
          }
          setRemoteConnected(true);
          setCallStatus("Live");
        },
        (candidate) => {
          const targetSocketId = remoteSocketIdRef.current;
          if (targetSocketId) {
            socket.emit("ice-candidate", { candidate, to: targetSocketId });
          }
        }
      );

      peer.onconnectionstatechange = async () => {
        if (peer.connectionState === "connecting") {
          setCallStatus("Connecting");
        }

        if (peer.connectionState === "connected") {
          setCallStatus("Live");
        }

        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setCallStatus("Reconnecting");
          try {
            await emitOffer(true);
          } catch (error) {
            console.warn("ICE restart failed", error);
          }
        }

        if (peer.connectionState === "closed") {
          if (peerRef.current === peer) {
            clearRemoteMedia();
          }
        }
      };

      peerRef.current = peer;
      return peer;
    };

    const handleReady = async ({ peerId }) => {
      if (!streamRef.current || !peerId) {
        return;
      }

      console.info("[Patient MobileCall] ready", { roomId, peerId });
      createManagedPeer(peerId);
      await emitOffer();
    };

    const handleOffer = async ({ offer, from }) => {
      if (!streamRef.current || !offer || !from) {
        return;
      }

      console.info("[Patient MobileCall] offer", { roomId, from });
      const peer = createManagedPeer(from);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushCandidates();

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.info("[Patient MobileCall] answer-created", { roomId, to: from });
      socket.emit("answer", { answer, to: from });
    };

    const handleAnswer = async ({ answer, from }) => {
      if (!answer || !peerRef.current) {
        return;
      }

      console.info("[Patient MobileCall] answer", { roomId, from });
      remoteSocketIdRef.current = from || remoteSocketIdRef.current;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await flushCandidates();
    };

    const handleIceCandidate = async ({ candidate, from }) => {
      if (!candidate) {
        return;
      }

      console.info("[Patient MobileCall] ice-candidate", { roomId, from });
      remoteSocketIdRef.current = from || remoteSocketIdRef.current;
      const iceCandidate = new RTCIceCandidate(candidate);

      if (!peerRef.current?.remoteDescription) {
        pendingCandidatesRef.current.push(iceCandidate);
        return;
      }

      await peerRef.current.addIceCandidate(iceCandidate);
    };

    const handlePeerLeft = () => {
      console.info("[Patient MobileCall] peer-left", { roomId });
      setCallStatus("Waiting");
      cleanupPeer();
    };

    const handleSessionReplaced = () => {
      console.info("[Patient MobileCall] session-replaced", { roomId });
      setCallStatus("Reconnecting");
      cleanupPeer();
    };

    const handleParticipantJoined = (payload) => {
      console.info("[Patient MobileCall] participant-joined", payload);
    };

    const handleChatHistory = (history = []) => {
      console.info("[Patient MobileCall] chat-history", {
        roomId,
        count: Array.isArray(history) ? history.length : 0,
      });

      const normalized = Array.isArray(history)
        ? history.map((entry) => ({
            ...entry,
            isMine: entry?.meta?.name === participantName,
          }))
        : [];

      setMessages(normalized);
    };

    const handleChatMessage = (payload) => {
      console.info("[Patient MobileCall] chat-message", payload);
      const isMine = payload?.meta?.name === participantName;

      setMessages((previous) => [
        ...previous,
        {
          ...payload,
          isMine,
        },
      ]);

      if (!isMine && !chatOpenRef.current) {
        setUnreadChatCount((count) => count + 1);
      }
    };

    const handleWaiting = (payload) => {
      console.info("[Patient MobileCall] waiting", payload);
      setCallStatus("Waiting");
    };

    const handleRoomFull = (payload) => {
      console.warn("[Patient MobileCall] room-full", payload);
      setCallStatus("Room full");
    };

    const handleConnectError = (error) => {
      console.error("[Patient MobileCall] connect_error", {
        message: error?.message,
        description: error?.description || null,
        context: error?.context || null,
      });
    };

    const handleDisconnect = (reason) => {
      console.warn("[Patient MobileCall] disconnect", { reason, roomId });
      setCallStatus("Disconnected");
    };

    const handleConnect = () => {
      setCallStatus("Joining");
      console.info("[Patient MobileCall] Joining room", {
        appointmentId,
        roomId,
        socketId,
        participantId,
        participantName,
        signalUrl: import.meta.env.VITE_SIGNAL_URL || "http://localhost:3044",
      });
      joinRoom({
        roomId,
        participantId,
        role: "patient",
        displayName: participantName,
      });
    };

    const handleJoinedRoom = (payload) => {
      console.info("[Patient MobileCall] Joined room", payload);
      setCallStatus("Waiting");
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = window.isSecureContext
          ? "Camera/microphone API is unavailable in this browser."
          : "Camera/microphone requires HTTPS or localhost in this browser.";
        setMediaError(message);
        throw new Error(message);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960, max: 1280 },
          height: { ideal: 540, max: 720 },
          frameRate: { ideal: 24, max: 24 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isMounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (localRef.current) {
        localRef.current.srcObject = stream;
      }

      socket.on("connect", handleConnect);
      socket.on("ready", handleReady);
      socket.on("offer", handleOffer);
      socket.on("answer", handleAnswer);
      socket.on("ice-candidate", handleIceCandidate);
      socket.on("peer-left", handlePeerLeft);
      socket.on("session-replaced", handleSessionReplaced);
      socket.on("joined-room", handleJoinedRoom);
      socket.on("participant-joined", handleParticipantJoined);
      socket.on("waiting", handleWaiting);
      socket.on("room-full", handleRoomFull);
      socket.on("connect_error", handleConnectError);
      socket.on("disconnect", handleDisconnect);
      socket.on("chat-history", handleChatHistory);
      socket.on("chat-message", handleChatMessage);

      if (socket.connected) {
        handleConnect();
      } else {
        socket.connect();
      }
    };

    start().catch((error) => {
      console.error("Unable to start mobile call", error);
    });

    return () => {
      isMounted = false;
      socket.off("connect", handleConnect);
      socket.off("ready", handleReady);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("peer-left", handlePeerLeft);
      socket.off("session-replaced", handleSessionReplaced);
      socket.off("joined-room", handleJoinedRoom);
      socket.off("participant-joined", handleParticipantJoined);
      socket.off("waiting", handleWaiting);
      socket.off("room-full", handleRoomFull);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat-history", handleChatHistory);
      socket.off("chat-message", handleChatMessage);
      socket.emit("leave-room");
      cleanupPeer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      socket.disconnect();
    };
  }, [appointmentId, participantId, participantName, roomId, socketId]);

  useEffect(() => {
    const blockKeys = (e) => {
      // ESC
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }

      // Refresh: F5 / Ctrl+R / Cmd+R
      if (
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const blockUnload = (e) => {
      if (allowExitRef.current) {
        return;
      }
      e.preventDefault();
      e.returnValue = ""; // Required for browser warning
    };

    const blockBack = () => {
      if (allowExitRef.current) {
        return;
      }
      window.history.pushState(null, "", window.location.href);
    };

    // Apply locks
    document.addEventListener("keydown", blockKeys);
    window.addEventListener("beforeunload", blockUnload);
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", blockBack);

    return () => {
      // Cleanup when call ends
      document.removeEventListener("keydown", blockKeys);
      window.removeEventListener("beforeunload", blockUnload);
      window.removeEventListener("popstate", blockBack);
    };
  }, []);

  const toggleMute = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted));
    setMuted(nextMuted);

    socket.emit("toggle-media", { 
      type: "audio", 
      enabled: !nextMuted, 
      to: remoteSocketIdRef.current 
    });
  };

  const toggleVideo = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const nextVideoEnabled = !videoEnabled;
    stream.getVideoTracks().forEach((track) => (track.enabled = nextVideoEnabled));
    setVideoEnabled(nextVideoEnabled);

    socket.emit("toggle-media", { 
      type: "video", 
      enabled: nextVideoEnabled, 
      to: remoteSocketIdRef.current 
    });
  };

  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);

  useEffect(() => {
    socket.on("toggle-media", ({ type, enabled }) => {
      if (type === "audio") setRemoteMuted(!enabled);
      if (type === "video") setRemoteVideoOff(!enabled);
    });

    return () => socket.off("toggle-media");
  }, []);

  const finishEndCall = () => {
    allowExitRef.current = true;
    const endPayload = {
      type: "video-call-ended",
      appointmentId,
      roomId,
      socketId,
      participantId,
      participantName,
      endedAt: new Date().toISOString(),
      returnUrl: buildAppReturnUrl({ appointmentId, roomId, socketId }),
    };

    try {
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteRef.current) {
        remoteRef.current.srcObject = null;
      }
      if (localRef.current) {
        localRef.current.srcObject = null;
      }
      socket.emit("leave-room", { roomId, appointmentId, socketId });
      socket.disconnect();
    } catch (error) {
      console.warn("Error ending call", error);
    }

    notifyHostApp(endPayload);
    setChatOpen(false);

    try {
      window.location.href = endPayload.returnUrl;
    } catch (error) {
      console.warn("Unable to redirect back to app", error);
    }

    window.setTimeout(() => {
      try {
        window.close();
      } catch (error) {
        console.warn("Unable to close window", error);
      }
    }, 150);

    window.setTimeout(() => {
      setCallEnded(true);
    }, 500);
  };

  const handleFeedbackSubmit = async ({ rating, heading, description }) => {
    if (!appointmentId) {
      setFeedbackOpen(false);
      if (pendingEndCallRef.current) {
        pendingEndCallRef.current = false;
        finishEndCall();
      }
      return;
    }

    setSubmittingFeedback(true);
    try {
      const updated = await submitPublicVideoFeedback(appointmentId, {
        role: "patient",
        rating,
        roomId,
        socketId,
        feedbackHeading: heading,
        feedbackDescription: description,
      });

      setSessionMeta(updated);
      feedbackSubmittedRef.current = true;
      setFeedbackOpen(false);

      if (pendingEndCallRef.current) {
        pendingEndCallRef.current = false;
        finishEndCall();
      }
    } catch (error) {
      console.warn("Unable to submit patient feedback", error);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleFeedbackSkip = () => {
    setFeedbackOpen(false);
    if (pendingEndCallRef.current) {
      pendingEndCallRef.current = false;
      finishEndCall();
    }
  };

  const endCall = () => {
    if (appointmentId && !feedbackSubmittedRef.current) {
      pendingEndCallRef.current = true;
      setFeedbackOpen(true);
      return;
    }

    finishEndCall();
  };

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, []);

  if (callEnded) {
    return (
      <div className="mobile-call mobile-call--ended">
        <div className="mobile-call__ended-card">
          <div className="mobile-call__ended-icon">OK</div>
          <h1>Call ended</h1>
          <p>You have left this video session.</p>
          <button
            type="button"
            onClick={() => {
              window.location.replace("https://vtalix.com/");
            }}
          >
            Back to join page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mobile-call ${chatOpen ? "mobile-call--chat-open" : ""}`}>
      {mediaError ? (
        <div style={{ color: "#fff", padding: "12px", textAlign: "center" }}>
          {mediaError}
        </div>
      ) : null}
      <div className="remote-container">
        <video ref={remoteRef} autoPlay playsInline className="remote" />

        <div className="call-topbar">
          <div>
            <p className="call-topbar__eyebrow">Patient video session</p>
            <h1 className="call-topbar__title">{participantName}</h1>
          </div>
          <div className={`call-status call-status--${callStatus.toLowerCase().replace(/\s+/g, "-")}`}>
            <span aria-hidden="true" />
            {callStatus}
          </div>
        </div>

        {!remoteConnected && !remoteVideoOff ? (
          <div className="remote-placeholder" aria-live="polite">
            <div className="remote-placeholder__avatar">DR</div>
            <p className="remote-placeholder__label">{callStatus}</p>
            <h2>Waiting for the provider</h2>
            <p className="remote-placeholder__hint">
              Keep this screen open. Your camera and microphone are ready.
            </p>
          </div>
        ) : null}

        <div className="status-overlay">
          {remoteMuted && (
            <div className="status-icon status-icon--muted">
              <img src={micOff} alt="" />
              <span>Provider muted</span>
            </div>
          )}
          {remoteVideoOff && (
            <div className="status-icon status-icon--video-off">
              <img src={videoOffIcon} alt="" />
              <span>Provider camera off</span>
            </div>
          )}
          {remoteVideoOff && (
            <div className="video-off-placeholder">
              <div className="remote-placeholder__avatar">DR</div>
              <img className="video-off-placeholder__icon" src={videoOffIcon} alt="" />
              <p>Provider camera is off</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="local-container" aria-label="Your preview">
          <video ref={localRef} autoPlay muted playsInline className="local" />
          {!videoEnabled && (
            <div className="local-video-off" aria-label="Your camera is off">
              <img src={videoOffIcon} alt="" />
            </div>
          )}
          <div className="local-container__label">You</div>
          <div className="local-media-badges">
            {muted && (
              <span className="local-media-badge" aria-label="Your microphone is muted">
                <img src={micOff} alt="" />
              </span>
            )}
            {!videoEnabled && (
              <span className="local-media-badge" aria-label="Your camera is off">
                <img src={videoOffIcon} alt="" />
              </span>
            )}
          </div>
      </div>

      <Controls
        onChat={() => {
          console.info("[Patient MobileCall] open chat", { roomId });
          setChatOpen(true);
        }}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        muted={muted}
        videoEnabled={videoEnabled}
        unreadChatCount={unreadChatCount}
      />

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        participantName={participantName}
        onSend={(message) => {
          const payload = {
            roomId,
            message,
            meta: {
              role: "patient",
              name: participantName,
            },
          };

          socket.emit("chat-message", payload);
        }}
      />

      <CallNoticeModal
        open={reminderOpen}
        title="15 minutes remaining"
        description="This session is nearing its scheduled end time. Please begin wrapping up the call."
        onAction={() => setReminderOpen(false)}
      />

      <CallFeedbackModal
        open={feedbackOpen}
        title="Rate this video session"
        description="Please share your rating and quick feedback before leaving the call."
        submitLabel={submittingFeedback ? "Submitting..." : "Submit feedback"}
        disabled={submittingFeedback}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
      />
    </div>
  );
}
