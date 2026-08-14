export function sortProviders(providers: any[]): any[] {
  if (!Array.isArray(providers)) return [];
  return [...providers].sort((a, b) => {
    if (!a || typeof a !== "object") return 1;
    if (!b || typeof b !== "object") return -1;

    const nameA = String(a.name || "").toLocaleLowerCase("en");
    const nameB = String(b.name || "").toLocaleLowerCase("en");
    const nameCompare = nameA.localeCompare(nameB, "en");
    if (nameCompare !== 0) {
      return nameCompare;
    }

    const origNameA = String(a.name || "");
    const origNameB = String(b.name || "");
    if (origNameA !== origNameB) {
      if (origNameA < origNameB) {
        return -1;
      } else {
        return 1;
      }
    }
    return 0;
  });
}

export function sortModels(models: any[], providers: any[]): any[] {
  if (!Array.isArray(models)) return [];
  const provs = Array.isArray(providers) ? providers : [];
  return [...models].sort((a, b) => {
    if (!a || typeof a !== "object") return 1;
    if (!b || typeof b !== "object") return -1;

    const provA = provs.find(
      (p) => p && typeof p === "object" && p.id === a.providerId,
    );
    const provB = provs.find(
      (p) => p && typeof p === "object" && p.id === b.providerId,
    );

    const nameA = String(provA?.name || "").toLocaleLowerCase("en");
    const nameB = String(provB?.name || "").toLocaleLowerCase("en");
    const provCompare = nameA.localeCompare(nameB, "en");
    if (provCompare !== 0) {
      return provCompare;
    }

    const idA = String(a.modelId || "").toLocaleLowerCase("en");
    const idB = String(b.modelId || "").toLocaleLowerCase("en");
    const idCompare = idA.localeCompare(idB, "en");
    if (idCompare !== 0) {
      return idCompare;
    }

    const origNameA = String(provA?.name || "");
    const origNameB = String(provB?.name || "");
    if (origNameA !== origNameB) {
      if (origNameA < origNameB) {
        return -1;
      } else {
        return 1;
      }
    }

    const origIdA = String(a.modelId || "");
    const origIdB = String(b.modelId || "");
    if (origIdA !== origIdB) {
      if (origIdA < origIdB) {
        return -1;
      } else {
        return 1;
      }
    }
    return 0;
  });
}
