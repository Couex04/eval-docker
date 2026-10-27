import { useEffect, useState } from "react";

function App() {
  const [instruction, setInstruction] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch("/api/instruction")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Erreur API");
        }
        return response.json();
      })
      .then((data) => setInstruction(data))
      .catch(() => setErreur("Impossible de récupérer l'instruction"));
  }, []);

  return (
    <main>
      <h1>Évaluation Docker</h1>
      <h2>Frontend React + Backend Express + PostgreSQL</h2>

      {erreur && <p>{erreur}</p>}

      {instruction ? (
        <p>{instruction.message}</p>
      ) : (
        !erreur && <p>Chargement de l'instruction...</p>
      )}
    </main>
  );
}

export default App;