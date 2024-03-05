"use client"

import { FormEvent, useState } from "react";

export const Form = () => {
    const [message, setMessage] = useState("");
    const handlePostMessage = async (e: FormEvent) => {
        e.preventDefault();
        const res = await fetch("/mongodb/write", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message }),
        });
        await res.json();
        window.location.reload();
    };
  
    return (
        <form onSubmit={handlePostMessage} className="max-w-sm flex flex-col space-y-4">
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="border p-1 bg-gray-900 text-white w-full"
            />
            <button type="submit" className="border p-1">
                Submit
            </button>
        </form>
    );
  };
  