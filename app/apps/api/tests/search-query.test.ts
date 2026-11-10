import { FacetQuerySchema, RoomListQuerySchema, RoomSearchSchema } from "@thm/shared";
import { describe, expect, it } from "vitest";

const schemas = [RoomListQuerySchema, FacetQuerySchema, RoomSearchSchema];

describe("recherche — validation partagée du catalogue", () => {
  it.each([
    ["octet nul seul", "\u0000"],
    ["octet nul dans un terme", "nmap\u0000linux"],
    ["tabulation avant le terme", "\tnmap"],
    ["retour à la ligne après le terme", "nmap\n"],
    ["retour chariot dans le terme", "nmap\rlinux"],
    ["échappement", "nmap\u001b"],
    ["suppression", "nmap\u007f"],
    ["contrôle C1", "nmap\u0085"],
    ["dernier contrôle C1", "nmap\u009f"],
  ])("refuse %s avant toute normalisation", (_name, q) => {
    for (const schema of schemas) {
      const result = schema.safeParse({ q });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toContainEqual(["q"]);
      }
    }
  });

  it("conserve les recherches multilingues, la ponctuation et les espaces ordinaires", () => {
    const q = '  sécurité réseau 日本語 "web security" -windows  ';
    for (const schema of schemas) {
      expect(schema.parse({ q }).q).toBe(q.trim());
      expect(schema.safeParse({}).success).toBe(true);
    }
  });
});
