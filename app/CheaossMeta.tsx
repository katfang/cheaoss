"use client";
import { useState, useEffect } from "react";
import { useCheaoss, Team } from "../api/cheaoss/v1/cheaoss_rbt_react";
import Error from "./Error";

export default function CheaossMeta({ gameId } : { gameId: string }) {
  const { assignTeam } = useCheaoss({id: gameId});
  let [team, setTeam] = useState(Team.WHITE);

  useEffect(() => {
    async function fetchTeamAssignment() {
      const {response } = await assignTeam({});
      console.log("game heaeder", response);
      if (response === undefined) {
        return (
          <Error message="Could not get team" />
        )
      }
      setTeam(response.team);
    }
    fetchTeamAssignment();
  }, []);

  return (
    <div className="w-full text-right">Assigned to team {Team[team]}.</div>
  );
}