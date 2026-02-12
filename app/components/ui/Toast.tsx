'use client'

import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type Props = {
    id: string
    type?: ToastType
    message: string
    onClose: (id: string) => void
    duration?: number
}

const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
}

export default function Toast({
    id,
    type = 'info',
    message,
    onClose,
    duration = 3000,
}: Props) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id)
        }, duration)

        return () => clearTimeout(timer)
    }, [id, duration, onClose])

    return (
        <div className="flex items-center w-full max-w-sm p-4 mb-4 bg-white rounded-lg shadow-lg border-l-4 animate-slide-in">
            {icons[type]}
            <div className="ml-3 text-sm font-medium">{message}</div>
            <button
                className="ml-auto p-1.5"
                onClick={() => onClose(id)}
            >
                <X size={16} />
            </button>
        </div>
    )
}
