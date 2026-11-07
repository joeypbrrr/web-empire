import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { accentFor, kindLabel } from "./palette.js";

const MAX_PIXEL_RATIO = 2;
const STATION_Z = [-1.85, 0.25, 2.35];

/**
 * Interior diorama. No shadow maps, no postprocessing.
 * Pixel ratio is capped for iPhone Safari.
 */
export function mountRoom(canvas, data, hooks) {
  const stage = canvas.parentElement;
  const coarse =
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 800;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !coarse,
    alpha: false,
    powerPreference: coarse ? "low-power" : "default",
  });
  renderer.setClearColor(0x1a1424, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.55;
  controls.minDistance = 3.4;
  controls.maxDistance = 18;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1.2, -0.15);

  const pickables = [];
  const stations = {};
  const siteCards = {};
  const geos = new Map();

  scene.add(new THREE.AmbientLight(0xfff4e8, 0.62));
  scene.add(new THREE.HemisphereLight(0xffe8d2, 0x3a2a44, 0.5));
  const key = new THREE.DirectionalLight(0xfff7ee, 0.7);
  key.position.set(2.4, 6.2, 5.2);
  scene.add(key);
  const warm = new THREE.PointLight(0xffb15e, 1.35, 11, 2);
  warm.position.set(0, 2.2, 1.4);
  scene.add(warm);
  const accent = new THREE.PointLight(0xff4d8d, 0.38, 8, 2);
  accent.position.set(0, 1.9, -2.2);
  scene.add(accent);

  const mats = {
    wall: lambert(0x4a3d62),
    trim: lambert(0x241c30),
    board: lambert(0x5a4638),
    desk: lambert(0x6a4632),
    top: lambert(0xd7a06c),
    chair: lambert(0x2a2233),
    bezel: lambert(0x16121c),
    pot: lambert(0xc46a4a),
    plant: lambert(0x3f8f5b),
    bookA: lambert(0xff4d8d),
    bookB: lambert(0x3ee0c5),
    bookC: lambert(0xffb020),
    bookD: lambert(0x8eb6ff),
    mug: lambert(0xf4efe6),
  };
  const wood = woodTexture();
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(3, 2.4);
  mats.floor = new THREE.MeshLambertMaterial({ map: wood });

  buildShell();
  buildProps();
  buildStations(data.agents || []);
  buildShipWall(data.readyToShip || data.sites || []);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  let homed = false;
  let looping = false;

  canvas.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  window.addEventListener("pointerup", (event) => {
    if (!down || event.pointerId !== down.id) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    down = null;
    if (dx * dx + dy * dy > 144) return;
    pick(event.clientX, event.clientY);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  resize();
  renderer.render(scene, camera);
  startLoop();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startLoop();
  });

  return {
    get pixelRatio() {
      return renderer.getPixelRatio();
    },
    get shadows() {
      return renderer.shadowMap.enabled;
    },
    screenPoint,
    highlightAgent,
    highlightSite,
    resetView() {
      applyHome();
    },
  };

  function startLoop() {
    if (looping) return;
    looping = true;
    const frame = () => {
      if (document.hidden) {
        looping = false;
        return;
      }
      requestAnimationFrame(frame);
      controls.update();
      renderer.render(scene, camera);
    };
    requestAnimationFrame(frame);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width < 2 || height < 2) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    if (!homed) {
      applyHome();
      homed = true;
    }
  }

  function applyHome() {
    const narrow = camera.aspect < 1.2;
    camera.fov = narrow ? 54 : 40;
    camera.updateProjectionMatrix();
    if (narrow) {
      camera.position.set(0, 4.55, 9.35);
      controls.target.set(0, 1.05, 0);
    } else {
      camera.position.set(0.25, 4.2, 7.25);
      controls.target.set(0, 1.15, -0.05);
    }
    controls.update();
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const found = hits.find((hit) => hit.object.userData.pick);
    if (!found) return;
    const item = found.object.userData.pick;
    if (item.type === "agent") hooks.onAgent(item.id);
    if (item.type === "site") hooks.onSite(item);
  }

  function screenPoint(id) {
    const station = stations[id];
    if (!station) return null;
    const point = station.label.getWorldPosition(new THREE.Vector3());
    point.project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: (point.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-point.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }

  function highlightAgent(id) {
    for (const [agentId, station] of Object.entries(stations)) {
      station.ring.visible = agentId === id;
    }
  }

  function highlightSite(slug) {
    for (const [cardSlug, card] of Object.entries(siteCards)) {
      card.scale.setScalar(cardSlug === slug ? 1.06 : 1);
    }
  }

  function buildShell() {
    addBox(scene, [9.6, 0.16, 8.15], mats.floor, 0, -0.08, 0);
    addBox(scene, [9.6, 3.3, 0.16], mats.wall, 0, 1.65, -4.02);
    addBox(scene, [0.16, 3.3, 8.15], mats.wall, -4.78, 1.65, 0);
    addBox(scene, [0.16, 3.3, 8.15], mats.wall, 4.78, 1.65, 0);
    addBox(scene, [9.6, 0.14, 0.1], mats.trim, 0, 0.07, -3.9);
    addBox(scene, [0.1, 0.14, 8.0], mats.trim, -4.66, 0.07, 0);
    addBox(scene, [0.1, 0.14, 8.0], mats.trim, 4.66, 0.07, 0);
    for (const z of [-2.55, 2.45]) {
      addBox(scene, [9.35, 0.1, 0.14], mats.trim, 0, 3.18, z);
    }
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 28),
      new THREE.MeshLambertMaterial({ map: rugTexture(), transparent: true })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 0.15);
    scene.add(rug);

    addStrip(-4.62, 0, 0x3ee0c5, "x");
    addStrip(4.62, 0, 0xff4d8d, "x");
    addStrip(0, -3.88, 0xffb020, "z");

    const plate = texturedPlane(2.4, 0.72, signTexture("READING", "19601"));
    plate.position.set(-4.66, 1.85, 3.15);
    plate.rotation.y = Math.PI / 2;
    scene.add(plate);

    const flow = texturedPlane(2.2, 0.7, signTexture("SCOUT → BUILD", "SHIP → CALL"));
    flow.position.set(4.66, 1.85, 3.15);
    flow.rotation.y = -Math.PI / 2;
    scene.add(flow);
  }

  function addStrip(x, z, color, axis) {
    const size = axis === "x" ? [0.06, 0.05, 7.6] : [8.8, 0.05, 0.06];
    const mesh = addBox(scene, size, new THREE.MeshBasicMaterial({ color }), x, 0.04, z);
    return mesh;
  }

  function buildProps() {
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, 0.2, 10),
      lambert(0xf0c48a)
    );
    shade.position.set(0, 2.15, 2.55);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe1a8 })
    );
    bulb.position.set(0, 2.0, 2.55);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6),
      mats.trim
    );
    cord.position.set(0, 2.65, 2.55);
    scene.add(shade, bulb, cord);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 8), mats.pot);
    pot.position.set(-4.15, 0.09, -3.35);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mats.plant);
    leaves.position.set(-4.15, 0.36, -3.35);
    scene.add(pot, leaves);

    const shelf = addBox(scene, [0.28, 0.08, 1.15], mats.desk, 4.45, 1.15, -3.2);
    shelf.rotation.y = 0;
    const colors = [mats.bookA, mats.bookB, mats.bookC, mats.bookD, mats.bookA];
    colors.forEach((material, index) => {
      addBox(scene, [0.12, 0.32, 0.16], material, 4.48, 1.36, -3.55 + index * 0.2);
    });
  }

  function buildStations(agents) {
    const rooms = agents.filter((agent) => agent.kind === "room");
    const leads = agents.filter((agent) => agent.kind === "lead");
    rooms.forEach((agent, index) => station(agent, "left", index));
    leads.forEach((agent, index) => station(agent, "right", index));
  }

  function station(agent, side, index) {
    const group = new THREE.Group();
    const z = STATION_Z[index] ?? 0;
    group.position.set(side === "left" ? -2.85 : 2.85, 0, z);
    if (side === "right") group.rotation.y = Math.PI;
    scene.add(group);

    const color = accentFor(agent.id);
    const hoodie = lambert(color);
    addBox(group, [0.86, 0.08, 1.28], mats.top, 0.28, 0.76, 0);
    addBox(group, [0.7, 0.68, 1.08], mats.desk, 0.28, 0.38, 0);
    addBox(group, [0.34, 0.08, 0.34], mats.chair, -0.28, 0.46, 0);
    addBox(group, [0.08, 0.46, 0.34], mats.chair, -0.46, 0.78, 0);
    addBox(group, [0.28, 0.34, 0.32], hoodie, -0.08, 0.98, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), hoodie);
    head.position.set(-0.08, 1.32, 0);
    group.add(head);
    const visor = addBox(group, [0.05, 0.045, 0.16], new THREE.MeshBasicMaterial({ color }), 0.05, 1.33, 0);
    visor.position.x = 0.04;

    addBox(group, [0.08, 0.42, 0.64], mats.bezel, 0.58, 1.08, 0);
    addBox(group, [0.05, 0.16, 0.06], mats.bezel, 0.5, 0.84, 0);
    const screen = texturedPlane(0.56, 0.32, screenTexture(agent.status || "Not running", color));
    screen.position.set(0.53, 1.08, 0);
    screen.rotation.y = -Math.PI / 2;
    group.add(screen);

    addBox(group, [0.26, 0.025, 0.1], mats.bezel, 0.22, 0.82, 0.28);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.08, 8), mats.mug);
    mug.position.set(0.18, 0.84, -0.38);
    group.add(mug);

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nameTexture(agent.name || agent.id, kindLabel(agent.kind), color),
        transparent: true,
        depthWrite: false,
      })
    );
    const labelY = [2.05, 1.74, 1.46][index] ?? 1.74;
    label.position.set(-0.72, labelY, 0);
    label.scale.set(1.22, 0.38, 1);
    group.add(label);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.74, 28),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    group.add(ring);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.15, 0.8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.set(0, 0.9, 0);
    group.add(hit);

    const pick = { type: "agent", id: agent.id };
    group.traverse((obj) => {
      if (obj.isMesh || obj.isSprite) {
        obj.userData.pick = pick;
        pickables.push(obj);
      }
    });
    stations[agent.id] = { group, ring, label };
  }

  function buildShipWall(sites) {
    addBox(scene, [5.8, 2.35, 0.08], mats.board, 0, 1.62, -3.84);
    const header = texturedPlane(5.0, 0.42, bannerTexture("READY TO SHIP"));
    header.position.set(0, 2.52, -3.76);
    scene.add(header);
    const shown = sites.slice(0, 4);
    if (!shown.length) {
      const empty = texturedPlane(3.2, 0.8, bannerTexture("Nothing ready yet"));
      empty.position.set(0, 1.45, -3.76);
      scene.add(empty);
      return;
    }
    const gap = shown.length === 1 ? 0 : 2.35;
    shown.forEach((site, index) => {
      const card = texturedPlane(2.15, 1.28, shipCardTexture(site));
      const x = (index - (shown.length - 1) / 2) * gap;
      card.position.set(x, 1.4, -3.76);
      card.userData.pick = {
        type: "site",
        slug: site.slug,
        url: site.previewUrl,
      };
      scene.add(card);
      pickables.push(card);
      siteCards[site.slug] = card;
    });
  }

  function addBox(parent, size, material, x, y, z) {
    const key = size.join("x");
    let geo = geos.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
      geos.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }
}

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function texturedPlane(width, height, map) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, transparent: true })
  );
  return mesh;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function woodTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = "#8a5a38";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16; i += 1) {
      g.fillStyle = i % 2 ? "rgba(70, 32, 16, 0.18)" : "rgba(255, 214, 170, 0.08)";
      g.fillRect(0, i * 16, 256, 14);
    }
    g.fillStyle = "rgba(40, 16, 8, 0.45)";
    for (const x of [0, 86, 172]) g.fillRect(x, 0, 3, 256);
  });
}

function rugTexture() {
  return canvasTexture(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#6d3058";
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#3ee0c5";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(128, 128, 86, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#ffb020";
    g.beginPath();
    g.arc(128, 128, 16, 0, Math.PI * 2);
    g.fill();
  });
}

function nameTexture(name, role, accent) {
  return canvasTexture(512, 160, (g) => {
    g.fillStyle = "rgba(18, 12, 26, 0.94)";
    roundRect(g, 8, 8, 496, 144, 24);
    g.fill();
    g.fillStyle = accent;
    g.fillRect(8, 8, 496, 10);
    g.font = "700 42px sans-serif";
    g.fillStyle = "#f7f2ea";
    g.fillText(fit(g, name, 460), 28, 82);
    g.font = "600 24px sans-serif";
    g.fillStyle = "#d9d0e4";
    g.fillText(role, 28, 122);
  });
}

function screenTexture(status, accent) {
  return canvasTexture(256, 144, (g) => {
    g.fillStyle = "#120e18";
    g.fillRect(0, 0, 256, 144);
    g.fillStyle = accent;
    g.fillRect(0, 0, 256, 6);
    g.font = "700 22px sans-serif";
    const text = String(status || "Not running").toUpperCase();
    g.fillText(fit(g, text, 220), 16, 82);
  });
}

function shipCardTexture(site) {
  return canvasTexture(512, 320, (g) => {
    g.fillStyle = "#24182f";
    g.fillRect(0, 0, 512, 320);
    g.strokeStyle = "#ffb020";
    g.lineWidth = 14;
    g.strokeRect(10, 10, 492, 300);
    g.font = "700 48px sans-serif";
    g.fillStyle = "#fff8ef";
    wrap(g, site.name || site.slug || "Site", 36, 120, 440, 56, 2);
    g.font = "600 28px sans-serif";
    g.fillStyle = "#ffd48a";
    g.fillText(fit(g, site.slug || "", 440), 36, 250);
  });
}

function bannerTexture(text) {
  return canvasTexture(1024, 160, (g) => {
    g.fillStyle = "rgba(20, 12, 24, 0.92)";
    g.fillRect(0, 0, 1024, 160);
    g.fillStyle = "#ffb020";
    g.font = "700 64px sans-serif";
    const label = fit(g, text, 960);
    const width = g.measureText(label).width;
    g.fillText(label, (1024 - width) / 2, 100);
  });
}

function signTexture(top, bottom) {
  return canvasTexture(512, 320, (g) => {
    g.fillStyle = "#24182f";
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = "#3ee0c5";
    g.fillRect(0, 0, 512, 12);
    g.font = "700 42px sans-serif";
    g.fillStyle = "#f7f2ea";
    g.fillText(fit(g, top, 460), 28, 130);
    g.font = "700 54px sans-serif";
    g.fillStyle = "#ffb020";
    g.fillText(fit(g, bottom, 460), 28, 210);
  });
}

function fit(g, text, max) {
  let value = String(text || "");
  while (value.length > 1 && g.measureText(value).width > max) {
    value = `${value.slice(0, -2)}…`;
  }
  return value;
}

function wrap(g, text, x, y, max, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let drawn = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) {
      g.fillText(line, x, y);
      drawn += 1;
      if (drawn >= maxLines) return;
      line = word;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  if (line && drawn < maxLines) g.fillText(line, x, y);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
