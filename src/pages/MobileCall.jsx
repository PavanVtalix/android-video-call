import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

  return (
    <div className="mobile-call">
      <div className="remote-container">
        <video ref={remoteRef} autoPlay playsInline className="remote" />
      </div>
      <video ref={localRef} autoPlay muted playsInline className="local" />

      <Controls
        onChat={() => setChatOpen(true)}
        onEnd={() => window.close()}
      />

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
