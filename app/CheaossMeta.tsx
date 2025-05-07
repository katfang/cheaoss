"use client";
import { useState, useEffect } from "react";
import { useCheaoss, Team } from "../api/cheaoss/v1/cheaoss_rbt_react";
import Error from "./Error";

export default function CheaossMeta({
  gameId,
  playerId
} : {
  gameId: string,
  playerId: string
}) {
  const { assignTeam } = useCheaoss({id: gameId});
  let [team, setTeam] = useState(Team.WHITE);

  useEffect(() => {
    async function fetchTeamAssignment() {
      const { response } = await assignTeam({playerId: playerId});
      console.log("game heaeder", response);
      if (response === undefined) {
        return (
          <Error message="Could not get team" />
        )
      }
      setTeam(response.team);
    }
    fetchTeamAssignment();
  }, [playerId]);

  return (
    <div className="w-full text-right">Assigned to team {Team[team]}.</div>
  );
}