'use client'

import Link from 'next/link'
import React from 'react'

type ButtonProps = {
    children: React.ReactNode
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'white'
    href?: string
    className?: string
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
}

export default function Button({
    children,
    variant = 'primary',
    href,
    className = '',
    onClick,
    type = 'button',
    disabled = false,
}: ButtonProps) {
    const baseStyles =
        'inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-300 transform hover:-translate-y-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
        primary:
            'bg-primary text-white shadow-soft hover:shadow-hover hover:bg-primary-dark',
        secondary:
            'bg-secondary text-white shadow-soft hover:shadow-hover hover:bg-secondary-dark',
        outline:
            'border-2 border-primary text-primary hover:bg-primary-50',
        ghost:
            'text-primary hover:bg-primary-50',
        white:
            'bg-white text-primary shadow-soft hover:shadow-hover hover:bg-gray-50',
    }

    const finalClassName = `${baseStyles} ${variants[variant]} ${className}`

    if (href) {
        return (
            <Link href={href} className={finalClassName}>
                {children}
            </Link>
        )
    }

    return (
        <button
            type={type}
            className={finalClassName}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    )
}
