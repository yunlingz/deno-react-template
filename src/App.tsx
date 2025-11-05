import { useEffect, useState } from "react";

type IdProfile = {
  claims: {
    sub: string; // userID
    [key: string]: unknown;
  };
};

type ExtendedProfile = {
  username: string;
  favoriteEmoji: string;
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

  if (loading) return <div>Loading...</div>;

  if (!signedIn) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Please sign in with OAuth2</h2>
        <button onClick={handleSignIn} type="submit">Sign in</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Welcome!</h2>
      <p>
        <b>User ID:</b> {idProfile?.claims.sub}
        <br />
        <b>User Name:</b> {extendedProfile?.username}
        <br />
        <b>Favorite Emoji:</b>{" "}
        <span style={{ fontSize: "2rem" }}>
          {extendedProfile?.favoriteEmoji}
        </span>
      </p>
      <button
        onClick={handleLogout}
        type="button"
        style={{ marginTop: "1rem" }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;
