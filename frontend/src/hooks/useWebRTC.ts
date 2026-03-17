"use client";
/**
 * useWebRTC — WebRTC P2P audio call hook using the existing /api/ws WebSocket
 * for signaling (offer/answer/ICE) and coturn/coturn for NAT traversal.
 *
 * Signaling message format over WS (client → server relay):
 *   { type: "signal", to: "<user_id>", data: <SignalData> }
 *
 * Received signal messages (server → client):
 *   { type: "signal", from: "<user_id>", data: <SignalData> }
 *
 * SignalData types:
 *   call_request  — incoming call notification  { callerId, callerName }
 *   call_accept   — callee accepted
 *   call_reject   — callee rejected
 *   call_hangup   — either party hung up
 *   offer         — SDP offer  { sdp }
 *   answer        — SDP answer { sdp }
 *   ice           — ICE candidate { candidate, sdpMid, sdpMLineIndex }
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type CallState =
  | "idle"
  | "calling"      // outgoing call in progress (waiting for accept)
  | "receiving"    // incoming call ring
  | "connecting"   // ICE / media negotiation
  | "active"       // call established
  | "ended";       // just ended (briefly, before reset)

export interface IncomingCall {
  userId: string;
  userName: string;
}

interface TurnCredentials {
  username: string;
  credential: string;
  uris: string[];
}

async function fetchTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/ws/turn-credentials", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [{ urls: "stun:stun.l.google.com:19302" }];
    const data: TurnCredentials = await res.json();
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: data.uris, username: data.username, credential: data.credential },
    ];
  } catch {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

export function useWebRTC(wsRef: React.MutableRefObject<WebSocket | null>) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Attach remote stream to the hidden audio element
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return () => {
      remoteAudioRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (callState === "active") {
      setCallDuration(0);
      callTimerRef.current = setInterval(
        () => setCallDuration((d) => d + 1),
        1000
      );
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  const sendSignal = useCallback(
    (to: string, data: object) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "signal", to, data }));
      }
    },
    [wsRef]
  );

  const cleanupPC = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    iceCandidateQueueRef.current = [];
  }, []);

  const endCall = useCallback(
    (notifyRemote = true) => {
      if (notifyRemote && remoteUserId) {
        sendSignal(remoteUserId, { type: "call_hangup" });
      }
      cleanupPC();
      setCallState("ended");
      setTimeout(() => {
        setCallState("idle");
        setRemoteUserId(null);
        setIncomingCall(null);
        setCallDuration(0);
      }, 1500);
    },
    [remoteUserId, sendSignal, cleanupPC]
  );

  const createPeerConnection = useCallback(
    async (targetUserId: string): Promise<RTCPeerConnection> => {
      const iceServers = await fetchTurnCredentials();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendSignal(targetUserId, { type: "ice", ...candidate.toJSON() });
        }
      };
      pc.ontrack = ({ streams }) => {
        if (streams[0]) setRemoteStream(streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("active");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          endCall(false);
        }
      };
      return pc;
    },
    [sendSignal, endCall]
  );

  // ── Initiate outgoing call ─────────────────────────────────────────────────
  const startCall = useCallback(
    async (targetUserId: string, myName: string) => {
      if (callState !== "idle") return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setRemoteUserId(targetUserId);
        setCallState("calling");

        const pc = await createPeerConnection(targetUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // Notify the other side
        sendSignal(targetUserId, {
          type: "call_request",
          callerId: "",           // filled by server relay ("from")
          callerName: myName,
        });
      } catch {
        setCallState("idle");
      }
    },
    [callState, createPeerConnection, sendSignal]
  );

  // ── Accept incoming call ───────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { userId } = incomingCall;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setRemoteUserId(userId);
      setCallState("connecting");
      const pc = await createPeerConnection(userId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Drain queued ICE candidates
      for (const c of iceCandidateQueueRef.current) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      iceCandidateQueueRef.current = [];

      sendSignal(userId, { type: "call_accept" });
      setIncomingCall(null);
    } catch {
      rejectCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall, createPeerConnection, sendSignal]);

  // ── Reject incoming call ───────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (incomingCall) {
      sendSignal(incomingCall.userId, { type: "call_reject" });
    }
    setIncomingCall(null);
    setCallState("idle");
    cleanupPC();
  }, [incomingCall, sendSignal, cleanupPC]);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  }, []);

  // ── Handle incoming signal messages ───────────────────────────────────────
  const handleSignal = useCallback(
    async (from: string, data: Record<string, unknown>) => {
      const type = data.type as string;

      switch (type) {
        case "call_request": {
          // Only show incoming ring if we are idle
          if (callState === "idle") {
            setIncomingCall({
              userId: from,
              userName: (data.callerName as string) || from,
            });
            setCallState("receiving");
          } else {
            // Already busy — auto-reject
            sendSignal(from, { type: "call_reject" });
          }
          break;
        }

        case "call_accept": {
          if (callState !== "calling" || !pcRef.current) break;
          setCallState("connecting");
          // Now create SDP offer
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          sendSignal(from, { type: "offer", sdp: offer.sdp });
          break;
        }

        case "call_reject": {
          cleanupPC();
          setCallState("ended");
          setTimeout(() => { setCallState("idle"); setRemoteUserId(null); }, 1500);
          break;
        }

        case "call_hangup": {
          endCall(false);
          break;
        }

        case "offer": {
          if (!pcRef.current) break;
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp: data.sdp as string })
          );
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: answer.sdp });
          // Drain queued ICE
          for (const c of iceCandidateQueueRef.current) {
            await pcRef.current.addIceCandidate(c).catch(() => {});
          }
          iceCandidateQueueRef.current = [];
          break;
        }

        case "answer": {
          if (!pcRef.current) break;
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.sdp as string })
          );
          break;
        }

        case "ice": {
          const candidate: RTCIceCandidateInit = {
            candidate: data.candidate as string,
            sdpMid: data.sdpMid as string,
            sdpMLineIndex: data.sdpMLineIndex as number,
          };
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(candidate).catch(() => {});
          } else {
            iceCandidateQueueRef.current.push(candidate);
          }
          break;
        }
      }
    },
    [callState, sendSignal, cleanupPC, endCall]
  );

  return {
    callState,
    incomingCall,
    remoteUserId,
    remoteStream,
    isMuted,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall: () => endCall(true),
    toggleMute,
    handleSignal,
  };
}
