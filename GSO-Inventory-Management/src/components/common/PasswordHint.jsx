import { passwordIssues, passwordStrength } from '../../services/passwordService';

// Shared password strength / policy feedback used by the register, profile
// and forgot-password forms so the rules are shown the same way everywhere.
export default function PasswordHint({ password, username }) {
    if (!password) {
        return (
            <div className="password-hint">
                <small>
                    Use at least 8 characters with an uppercase letter, a lowercase letter,
                    a number and a symbol.
                </small>
            </div>
        );
    }

    const issues = passwordIssues(password, { username });
    const strength = passwordStrength(password);

    return (
        <div className="password-hint">
            <div className={`strength-meter score-${strength.score}`} aria-hidden="true">
                <span /><span /><span /><span />
            </div>
            <small>
                Strength: <b>{strength.label}</b>
                {issues.length ? ' — still needs ' + issues.join(', ') : ' — meets all requirements.'}
            </small>
        </div>
    );
}
