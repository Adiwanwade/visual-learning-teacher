"use client";

import React, { useState, useRef, useCallback } from "react";
import { Brain, Camera, Lightbulb, Volume2, VolumeX } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";

const Home = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [solution, setSolution] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      setIsRecording(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setSolution("");
    }
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !isRecording) return null;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (err) {
      console.error("Frame capture error:", err);
      return null;
    }
  }, [isRecording]);

  const processFrame = async (imageData: string) => {
    try {
      setIsProcessing(true);
      console.log("Captured frame data:", imageData); // Debug log
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL;
    const response = await fetch(`${backendUrl}/api/process-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData }),
    });


      const data = await response.json();
      console.log("API response:", data); // Debug log
      if (data.solution) {
        setSolution(data.solution);
        if (!isMuted) {
          speak(data.solution);
        }
      }
    } catch (err) {
      console.error("Processing error:", err);
      setError("Error processing the image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCaptureClick = () => {
    const frameData = captureFrame();
    if (frameData) {
      processFrame(frameData);
    } else {
      console.error("No frame captured");
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
            Visual Learning Assistant
          </h1>
          <p className="text-gray-600">
            Capture, Learn, and Understand in Real-Time
          </p>
        </div>

        <Card className="backdrop-blur-sm bg-white/90 shadow-xl border-0 overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-600" />
                <CardTitle className="text-2xl font-bold text-gray-800">
                  Smart Camera Analysis
                </CardTitle>
              </div>
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-3 rounded-full hover:bg-white/50 transition-all duration-300 text-gray-700"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={isRecording ? stopCamera : startCamera}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-white transition-all duration-300 shadow-lg ${
                    isRecording
                      ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  }`}
                >
                  <Camera className="w-5 h-5" />
                  {isRecording ? "Stop Camera" : "Start Camera"}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {error && (
              <Alert
                variant="destructive"
                className="mb-6 border-red-200 bg-red-50"
              >
                <AlertDescription className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-xl border shadow-lg transition-transform duration-300 bg-gray-900"
                    style={{ minHeight: "360px" }}
                  />
                  {!isRecording && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 rounded-xl backdrop-blur-sm">
                      <p className="text-white flex items-center gap-2">
                        <Camera className="w-5 h-5" /> Camera Off
                      </p>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white text-sm font-medium">
                          Processing...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-6 h-6 text-yellow-500" />
                    <h2 className="text-xl font-semibold text-gray-800">
                      Solution
                    </h2>
                  </div>
                  {isProcessing && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm text-blue-600 font-medium">
                        Processing...
                      </p>
                    </div>
                  )}
                </div>
                <div className="min-h-[360px] bg-white/50 rounded-lg p-4 backdrop-blur-sm">
                  {solution ? (
                    <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {solution}
                    </p>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center">
                      <p className="text-gray-500 flex flex-col items-center gap-3">
                        <Camera className="w-8 h-8 text-gray-400" />
                        Point your camera at a problem to get started...
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCaptureClick}
                  disabled={!isRecording || isProcessing}
                  className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full font-medium shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture Frame
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
