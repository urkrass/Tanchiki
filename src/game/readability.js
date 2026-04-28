export function targetReadabilityCue(target) {
  if (!target.alive) {
    return {
      label: "X",
      name: "Destroyed",
      fillStyle: "#5a554c",
      textStyle: "#f7f4ea"
    };
  }

  if (target.type === "base") {
    return {
      label: "B",
      name: "Enemy base",
      fillStyle: "#6f2f2b",
      textStyle: "#f7f4ea"
    };
  }

  if (target.pursuitTarget === "player") {
    return {
      label: "!",
      name: "Pursuit enemy",
      fillStyle: "#a6342f",
      textStyle: "#fff7df"
    };
  }

  if (Array.isArray(target.patrolRoute)) {
    return {
      label: "P",
      name: "Patrol enemy",
      fillStyle: "#8a5a2f",
      textStyle: "#fff7df"
    };
  }

  return {
    label: "S",
    name: "Sentry enemy",
    fillStyle: "#8d3e34",
    textStyle: "#fff7df"
  };
}
