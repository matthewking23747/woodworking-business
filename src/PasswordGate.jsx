import React, { useState } from "react";

export default function PasswordGate({ children }) {
    const [authenticated, setAuthenticated] = useState(
        localStorage.getItem("authenticated") === "true"
    );
    const [password, setPassword] = useState("");
    const correctPassword = "Z@n3260918"; // 🔑 change this to your real password

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === correctPassword) {
            localStorage.setItem("authenticated", "true");
            setAuthenticated(true);
        } else {
            alert("Incorrect password");
        }
    };

    if (!authenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 text-center p-6">
                <h1 className="text-3xl font-bold text-amber-900 mb-4">🔒 Secure Access</h1>
                <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
                    <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border border-amber-300 rounded p-2 mb-4 w-64 text-center"
                    />
                    <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded"
                    >
                        Enter
                    </button>
                </form>
            </div>
        );
    }

    return children;
}
