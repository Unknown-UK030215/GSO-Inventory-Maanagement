import ELNIDO_LOGO from '../../assets/Elnido-Logo.png';
import GSO_LOGO from '../../assets/GSO-Logo.jpeg';
import { isSupabaseConfigured } from '../../lib/supabase';

export default function AuthFrame({ title, description, children, className = '', shellClassName = '' }) {
    return (
        <main className={`auth-shell ${shellClassName}`.trim()}>
            <section className={`auth-card ${className}`.trim()}>
                <div className="auth-logos">
                    <img src={ELNIDO_LOGO} alt="Municipality of El Nido logo" />
                    <img src={GSO_LOGO} alt="General Services Office logo" />
                </div>
                <small>GENERAL SERVICES OFFICE · EL NIDO</small>
                <h1>{title}</h1>
                <p className="auth-description">{description}</p>
                {children}
                <p className="auth-notice">
                    {isSupabaseConfigured
                        ? 'Secure sign-in and account data are managed by Supabase.'
                        : 'Local prototype sign-in only. Account data is stored in this browser and is not server-secured.'}
                </p>
            </section>
        </main>
    );
}
