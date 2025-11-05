import { useEffect, useState } from "react";
import "./App.css";

type IdProfile = {
  claims: {
    sub: string; // userID
    [key: string]: unknown;
  };
};

type ExtendedProfile = {
  username: string;
  avatar: string;
};

function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [idProfile, setIdProfile] = useState<IdProfile | null>(null);
  const [extendedProfile, setExtendedProfile] = useState<
    ExtendedProfile | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const [idRes, extRes] = await Promise.all([
          fetch("/api/id-profile"),
          fetch("/api/extended-profile"),
        ]);
        if (!idRes.ok || !extRes.ok) {
          throw new Error("Not signed in");
        }
        const idProf = await idRes.json();
        const extProf = await extRes.json();
        setIdProfile(idProf);
        setExtendedProfile(extProf);
        setSignedIn(true);
      } catch {
        setSignedIn(false);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const handleSignIn = () => {
    globalThis.location.href = "/api/login";
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "GET" });
    setSignedIn(false);
    setIdProfile(null);
    setExtendedProfile(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <h2 className="loading-title">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="container">
        <div className="card">
          <h2 className="signin-title">Sign in to see your profile</h2>
          <button
            onClick={handleSignIn}
            type="submit"
            className="main-btn"
          >
            Sign in with OAuth2
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="avatar-circle">
          <span className="avatar-emoji">
            {extendedProfile?.avatar}
          </span>
        </div>
        <h2 className="welcome-title">
          Welcome, {extendedProfile?.username}!
        </h2>
        <div className="info-box">
          <div>
            <b className="info-label">User ID:</b>{" "}
            <span className="info-value">
              {idProfile?.claims.sub}
            </span>
          </div>
          <div>
            <b className="info-label">User Name:</b> {extendedProfile?.username}
          </div>
        </div>
        <button
          onClick={handleLogout}
          type="button"
          className="main-btn"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;
