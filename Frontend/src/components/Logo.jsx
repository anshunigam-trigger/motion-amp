export default function Logo({ small, onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className={`logo__icon ${small ? 'logo__icon--sm' : ''}`}>
        <svg width={small ? 14 : 18} height={small ? 14 : 18} viewBox="0 0 24 24" fill="none">
          <path d="M2 12 L6 4 L10 16 L14 6 L18 14 L22 8" stroke="#E8741A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className={`logo__text ${small ? 'logo__text--sm' : ''}`}>
        Motion<span className="logo__accent">Amp</span>
      </span>
    </div>
  );
}
