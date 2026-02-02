// src/components/PageInfo.jsx
export default function PageInfo({ children }) {
  if (!children) return null;
  return (
    <div className="page-info">
      <i className="fa-regular fa-circle-question" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
