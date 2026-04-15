function buildIceServers() {
  const stunServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrls = (import.meta.env.VITE_TURN_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const turnUsername = import.meta.env.VITE_TURN_USERNAME || "";
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL || "";

  const turnServers = turnUrls.length > 0 && turnUsername && turnCredential
    ? [{
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      }]
    : [];

  return [...stunServers, ...turnServers];
}

export const config = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

function applySenderProfile(sender) {
  if (!sender?.track || typeof sender.getParameters !== "function") {
    return;
  }

  const track = sender.track;
  const parameters = sender.getParameters() || {};
  parameters.encodings = Array.isArray(parameters.encodings) && parameters.encodings.length > 0
    ? parameters.encodings
    : [{}];

  if (track.kind === "video") {
    track.contentHint = "motion";
    parameters.degradationPreference = "balanced";
    parameters.encodings[0].maxBitrate = 900_000;
    parameters.encodings[0].maxFramerate = 24;
    parameters.encodings[0].scaleResolutionDownBy = 1;
  }

  if (track.kind === "audio") {
    track.contentHint = "speech";
    parameters.encodings[0].maxBitrate = 64_000;
  }

  sender.setParameters(parameters).catch((error) => {
    console.warn("[Patient Peer] setParameters failed", {
      kind: track.kind,
      message: error?.message || String(error),
    });
  });
}

export function createPeerConnection(stream, onTrack, onIceCandidate) {
  const pc = new RTCPeerConnection(config);

  stream.getTracks().forEach((track) => {
    const sender = pc.addTrack(track, stream);
    applySenderProfile(sender);
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
    console.log("[Patient Peer] connectionState", pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[Patient Peer] iceConnectionState", pc.iceConnectionState);
  };

  pc.onicegatheringstatechange = () => {
    console.log("[Patient Peer] iceGatheringState", pc.iceGatheringState);
  };

  return pc;
}
