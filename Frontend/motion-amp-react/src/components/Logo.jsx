// Logo.jsx — shared across all three pages

export default function Logo({ small = false, onClick }) {
  return (
    <div
      className="logo"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`logo__icon${small ? " logo__icon--sm" : ""}`}
      >
        <svg
          width={small ? 14 : 20}
          height={small ? 14 : 20}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 10 Q5 4 8 10 Q11 16 14 10 Q17 4 20 10"
            stroke="#E8741A"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      <span
        className={`logo__text${small ? " logo__text--sm" : ""}`}
      >
        MOTION{" "}
        <span className="logo__accent">AMP</span>
      </span>
    </div>
  );
}