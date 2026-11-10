import ELNIDO_LOGO from '../../assets/Elnido-Logo.png';
import GSO_LOGO from '../../assets/GSO-Logo.jpeg';

export default function AuthFrame({ title, description, children }) {
    return (
        <main className="auth-shell">
            <section className="auth-card">
                <div className="auth-logos">
                    <img src={ELNIDO_LOGO} alt="Municipality of El Nido logo" />
                    <img src={GSO_LOGO} alt="General Services Office logo" />
                </div>
                <small>GENERAL SERVICES OFFICE · EL NIDO</small>
                <h1>{title}</h1>
                <p className="auth-description">{description}</p>
                {children}
                <p className="auth-notice">
                    Local prototype sign-in only. Account data is stored in this browser and is not server-secured.
                </p>
            </section>
        </main>
    );
}
