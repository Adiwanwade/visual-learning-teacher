"use client";

import React, { useState, useRef, useCallback } from "react";
import { Camera, Volume2, VolumeX } from "lucide-react";
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
      const response = await fetch("http://localhost:5000/api/process-image", {
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
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-2xl font-bold">
              Visual Learning Assistant
            </CardTitle>
            <div className="flex gap-4">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </button>
              <button
                onClick={isRecording ? stopCamera : startCamera}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                <Camera size={20} />
                {isRecording ? "Stop Camera" : "Start Camera"}
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg border"
                  style={{ minHeight: "320px", backgroundColor: "#000" }}
                />
                {!isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 rounded-lg">
                    <p className="text-white">Camera Off</p>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Solution</h2>
                  {isProcessing && (
                    <p className="text-sm text-blue-600">Processing...</p>
                  )}
                </div>
                <div className="min-h-[320px]">
                  {solution ? (
                    <p className="whitespace-pre-wrap">{solution}</p>
                  ) : (
                    <p className="text-gray-500">
                      Point your camera at a problem to get started...
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCaptureClick}
                  disabled={!isRecording || isProcessing}
                  className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
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
