export function sortProviders(providers: any[]): any[] {
  if (!Array.isArray(providers)) return [];
  return [...providers].sort((a, b) => {
    const isValA = a && typeof a === "object";
    const isValB = b && typeof b === "object";
    if (!isValA && !isValB) return 0;
    if (!isValA) return 1;
    if (!isValB) return -1;

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
    const isValA = a && typeof a === "object";
    const isValB = b && typeof b === "object";
    if (!isValA && !isValB) return 0;
    if (!isValA) return 1;
    if (!isValB) return -1;

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

    // NOTE: Strictly sorting by `modelId` (e.g. 'gemini-3.5-flash') rather than `displayName`
    // is a strict and explicit requirement from the user ("第二关键字是 模型id 字典序").
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
