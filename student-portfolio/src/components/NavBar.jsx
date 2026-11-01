import { Link } from "react-router-dom";

function NavBar() {
  return (
    <nav
      style={{
        background: "#4f46e5",
        padding: "15px",
        display: "flex",
        justifyContent: "center",
        gap: "30px",
      }}
    >
      <Link to="/" style={{ color: "white", textDecoration: "none" }}>
        Home
      </Link>

      <Link to="/projects" style={{ color: "white", textDecoration: "none" }}>
        Projects
      </Link>

      <Link to="/tasks" style={{ color: "white", textDecoration: "none" }}>
        Tasks
      </Link>

      <Link to="/contact" style={{ color: "white", textDecoration: "none" }}>
        Contact
      </Link>
    </nav>
  );
}

export default NavBar;