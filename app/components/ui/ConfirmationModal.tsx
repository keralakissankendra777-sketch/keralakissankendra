'use client'

import { AlertTriangle, X } from 'lucide-react'

type Props = {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
}: Props) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">

                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full text-red-600">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    </div>

                    <button onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <p className="text-gray-600 mb-8 ml-11">
                    {message}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-gray-700 font-bold hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    )
}
