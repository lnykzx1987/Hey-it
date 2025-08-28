/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface CircularProgressProps {
    progress: number;
    text?: string;
    size?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ progress, text, size = "w-32 h-32" }) => {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className={`relative flex items-center justify-center ${size}`}>
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                    className="text-gray-300"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                />
                <circle
                    className="text-gray-800"
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.3s ease' }}
                />
            </svg>
            <span className="absolute text-center text-sm font-mono text-gray-700">
                {text ? text : `${Math.round(progress)}%`}
            </span>
        </div>
    );
};

export default CircularProgress;