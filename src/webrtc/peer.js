export const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function createPeerConnection(stream, onTrack, onIceCandidate) {
  const pc = new RTCPeerConnection(config);

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  pc.ontrack = (event) => {
    onTrack(event.streams[0]);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("Peer connection state:", pc.connectionState);
  };

  return pc;
}
