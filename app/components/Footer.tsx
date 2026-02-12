import { Leaf, Instagram, Facebook, Twitter, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';


export default function Footer() {
    return (
        <footer id="footer" className="bg-green-900 text-white pt-16 pb-8">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Info */}
                    <div>
                        <div className="flex items-center gap-2 text-2xl font-bold mb-6 font-heading">
                            <Leaf className="text-primary-300" /> Kerala Kissan Kendra
                        </div>
                        <p className="text-primary-100 mb-6 leading-relaxed">
                            Bringing nature closer to your home. We provide the best quality indoor and outdoor plants to freshen up your living space.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-primary-500 transition-colors">
                                <Instagram size={20} />
                            </a>
                            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-primary-500 transition-colors">
                                <Facebook size={20} />
                            </a>
                            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-primary-500 transition-colors">
                                <Twitter size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-xl font-bold mb-6 font-heading">Quick Links</h3>
                        <ul className="space-y-4">
                            <li><Link href="/" className="text-primary-100 hover:text-white hover:translate-x-1 transition-transform inline-block">Home</Link></li>
                            <li><Link href="/shop" className="text-primary-100 hover:text-white hover:translate-x-1 transition-transform inline-block">Shop Collection</Link></li>
                            <li><Link href="/track" className="text-primary-100 hover:text-white hover:translate-x-1 transition-transform inline-block">Track Order</Link></li>
                            <li><Link href="/admin" className="text-primary-100 hover:text-white hover:translate-x-1 transition-transform inline-block">Admin Login</Link></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-xl font-bold mb-6 font-heading">Contact Us</h3>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3 text-primary-100">
                                <MapPin size={20} className="shrink-0 mt-1" />
                                <span>5955+PVR, Athani,<br />Kerala 683585</span>
                            </li>
                            <li className="flex items-center gap-3 text-primary-100">
                                <Phone size={20} className="shrink-0" />
                                <span>098479 06191</span>
                            </li>
                            <li className="flex items-center gap-3 text-primary-100">
                                <Mail size={20} className="shrink-0" />
                                <span>hello@keralakissankendra.com</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 text-center text-primary-300 text-sm">
                    <p>© {new Date().getFullYear()} Kerala Kissan Kendra. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}