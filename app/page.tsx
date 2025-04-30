"use client";
import { useHello } from "../api/hello/v1/hello_rbt_react";
import GameMeta from "./GameMeta";

export default function Home() {
  const { useMessages } = useHello({id: "reboot-hello"});
  const { response } = useMessages();

  if (response === undefined) {
    return "Absolute failure";
  }

  const allMessages = response.messages.map((msg, id) =>
    <p key={id}>{id}: {msg}</p>
  );

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <GameMeta gameId="singleton" />
      {allMessages} 
    </div>
  );
}
