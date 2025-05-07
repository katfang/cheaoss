"use client";

import { useEffect, useState } from "react";

import CheaossMeta from "./CheaossMeta";
import CheaossBoard from "./CheaossBoard";

export default function Home() {
  // TODO: possibly page is not really the right place for this, but both the Meta and the Board will want the information
  let [playerId, setPlayerId] = useState(crypto.randomUUID());
  useEffect(() => {
    let sessionPlayerId = sessionStorage.getItem('playerId');
    if (sessionPlayerId !== null) {
      setPlayerId(sessionPlayerId);
    } else {
      sessionStorage.setItem('playerId', playerId);
    }
  }, []);

  return (
    <div className="grid grid-cols-[1fr_1fr] grid-rows-[20px_1fr] items-center justify-items-center min-h-screen p-8 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full col-span-2 bg-gray-500 p-4">
        <CheaossMeta gameId="singleton" playerId={playerId} />
      </div>
      <div className="w-full h-full bg-gray-500 p-4">
        <CheaossBoard gameId="singleton" playerId={playerId} />
      </div>
      <div>
        Other Sidebar
      </div>
    </div>
  );
}