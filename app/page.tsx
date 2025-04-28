"use client";
import Image from "next/image";
import { useEffect } from "react";
import { useHello } from "../api/hello/v1/hello_rbt_react";
import { useCheaoss } from "../api/cheaoss/v1/cheaoss_rbt_react";

export default function Home() {
  const { assignTeam } = useCheaoss({id: "singleton"});
  const { useMessages, send } = useHello({id: "reboot-hello"});
  const { response } = useMessages();

  useEffect(() => {
    async function fetchTeamAssignment() {
      const res = await assignTeam({});
      console.log(res);
    }
    fetchTeamAssignment();
  }, []);

  if (response === undefined) {
    return "Absolute failure";
  }

  const allMessages = response.messages.map((msg, id) =>
    <p key={id}>{id}: {msg}</p>
  );

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      {allMessages} 
    </div>
  );
}
