/*
Clarity frontend condensed reference (standalone handoff).
Represents real architecture and contracts, not full UI source.
*/

import axios from "axios";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : "/api/v1";

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("ncertai_token") || "";
    const userRaw = localStorage.getItem("ncertai_user") || "";
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (userRaw) {
        try {
            const user = JSON.parse(userRaw);
            if (user?.name) config.headers["X-User-ID"] = user.name;
        } catch {
            // ignore
        }
    }
    return config;
});

export type VideoPayload = {
    class_num: string;
    subject: string;
    chapter: string;
    topic: string;
    duration_seconds?: number;
    style?: string;
    broll_mode?: "minimal" | "balanced" | "aggressive";
    montage_level?: "single" | "light" | "dynamic";
    min_external_segments?: number;
};

export async function generateVideoFile(payload: VideoPayload) {
    const response = await apiClient.post("/creative/video-file", payload, { responseType: "blob" });
    return {
        blob: response.data as Blob,
        meta: {
            externalVideoCount: Number(response.headers["x-external-video-count"] || 0),
            proceduralBrollCount: Number(response.headers["x-procedural-broll-count"] || 0),
            montageSegments: Number(response.headers["x-montage-segments"] || 0),
            brollMode: String(response.headers["x-broll-mode"] || payload.broll_mode || "balanced"),
            montageLevel: String(response.headers["x-montage-level"] || payload.montage_level || "single"),
            minExternalSegments: Number(payload.min_external_segments || 0),
        },
    };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const token = localStorage.getItem("ncertai_token");
    const user = localStorage.getItem("ncertai_user");
    return token && user ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

export default function AppReference() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/onboarding" element={<div>Onboarding</div>} />
                <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
                <Route path="/ask" element={<ProtectedRoute><div>Ask AI</div></ProtectedRoute>} />
                <Route path="/practice" element={<ProtectedRoute><div>Practice</div></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><div>Studio</div></ProtectedRoute>} />
                <Route path="/ocr" element={<ProtectedRoute><div>OCR</div></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
