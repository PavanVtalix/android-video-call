import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../services/socket";
import { createPeerConnection } from "../webrtc/peer";
import Controls from "../components/Controls";
import ChatDrawer from "../components/ChatDrawer";
import "../styles/mobile-call.css";

export default function MobileCall() {
  const { roomId } = useParams();
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    socket.connect();

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true
      });

      streamRef.current = stream;
      localRef.current.srcObject = stream;

      socket.emit("join-room", roomId);

      socket.on("ready", async (peerId) => {
        peerRef.current = createPeerConnection(
          stream,
          s => (remoteRef.current.srcObject = s),
          c => socket.emit("ice-candidate", { candidate: c, to: peerId })
        );

        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit("offer", { offer, to: peerId });
      });

      socket.on("offer", async ({ offer, from }) => {
        peerRef.current = createPeerConnection(
          stream,
          s => (remoteRef.current.srcObject = s),
          c => socket.emit("ice-candidate", { candidate: c, to: from })
        );

        await peerRef.current.setRemoteDescription(offer);
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("answer", { answer, to: from });
      });

      socket.on("answer", async ({ answer }) => {
        await peerRef.current.setRemoteDescription(answer);
      });

      socket.on("ice-candidate", async ({ candidate }) => {
        await peerRef.current.addIceCandidate(candidate);
      });
    };

    start();

    return () => {
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      socket.disconnect();
    };
  }, [roomId]);

  const toggleMute = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => (t.enabled = !muted));
    setMuted(m => !m);
  };

  const toggleVideo = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => (t.enabled = !videoEnabled));
    setVideoEnabled(v => !v);
  };

  const endCall = () => {
    try {
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      socket.disconnect();
    } catch (e) {
      console.warn('Error ending call', e);
    }
    try { navigate(-1); } catch (e) { /* ignore */ }
  };

  // Prevent body scrolling while on the mobile call screen
  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, []);

  return (
    <div className="mobile-call">
      <div className="remote-container">
        <video ref={remoteRef} autoPlay playsInline className="remote" />
      </div>
      <video ref={localRef} autoPlay muted={muted} playsInline className="local" />

      <Controls
        onChat={() => setChatOpen(true)}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        muted={muted}
        videoEnabled={videoEnabled}
      />

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
