import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Dockerfile Traefik routing (#586)", () => {
  it("routes canonical domain ziki.dev as well as legacy domains", () => {
    const dockerfilePath = path.join(process.cwd(), "Dockerfile");
    const content = fs.readFileSync(dockerfilePath, "utf8");

    expect(content).toContain('LABEL "traefik.enable"="true"');
    expect(content).toContain('LABEL "traefik.http.routers.ziki.rule"');
    expect(content).toContain("Host(`ziki.dev`)");
    expect(content).toContain("Host(`www.ziki.dev`)");
    expect(content).toContain("Host(`issues.zedu.chat`)");
    expect(content).toContain("(Host(`contributors.zedu.chat`) && PathPrefix(`/bug-tracker`))");
    expect(content).toContain('LABEL "traefik.http.services.ziki.loadbalancer.server.port"="3000"');
  });
});
