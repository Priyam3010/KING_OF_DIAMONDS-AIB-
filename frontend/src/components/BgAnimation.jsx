import React, { useEffect } from 'react';

const BgAnimation = () => {
    useEffect(() => {
        const canvas = document.getElementById('bgCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // --- Card Generation ---
        const makeCardCanvas = (label, suit, worn, cw, ch) => {
            const c = document.createElement('canvas');
            c.width = cw;
            c.height = ch;
            const x = c.getContext('2d');

            // Rounded rect card body
            const radius = cw * 0.08;
            x.beginPath();
            x.moveTo(radius, 0);
            x.lineTo(cw - radius, 0);
            x.quadraticCurveTo(cw, 0, cw, radius);
            x.lineTo(cw, ch - radius);
            x.quadraticCurveTo(cw, ch, cw - radius, ch);
            x.lineTo(radius, ch);
            x.quadraticCurveTo(0, ch, 0, ch - radius);
            x.lineTo(0, radius);
            x.quadraticCurveTo(0, 0, radius, 0);
            x.closePath();

            // warm parchment gradient
            const grd = x.createLinearGradient(0, 0, cw, ch);
            if (worn) {
                grd.addColorStop(0, '#cfc09a');
                grd.addColorStop(0.5, '#b89660');
                grd.addColorStop(1, '#9a7a40');
            } else {
                grd.addColorStop(0, '#f8f0e0');
                grd.addColorStop(0.5, '#ede0c0');
                grd.addColorStop(1, '#d8c898');
            }
            x.fillStyle = grd;
            x.fill();

            // Gold border
            x.strokeStyle = 'rgba(180,140,50,0.9)';
            x.lineWidth = cw * 0.025;
            x.stroke();

            // Inner border
            const pad = cw * 0.05;
            x.strokeStyle = 'rgba(180,140,50,0.4)';
            x.lineWidth = 1;
            x.strokeRect(pad, pad, cw - pad * 2, ch - pad * 2);

            // Suit color
            const isRed = (suit === '♦' || suit === '♥');
            x.fillStyle = isRed ? '#c0001a' : '#111';

            // Corner labels
            const drawLabel = (tx, ty, rot) => {
                x.save();
                x.translate(tx, ty);
                x.rotate(rot);
                x.textAlign = 'center';
                x.font = `bold ${cw * 0.14}px Cinzel`;
                x.fillText(label, 0, 0);
                x.font = `${cw * 0.12}px serif`;
                x.fillText(suit, 0, cw * 0.12);
                x.restore();
            };

            drawLabel(cw * 0.12, cw * 0.18, 0);
            drawLabel(cw * 0.88, ch - cw * 0.18, Math.PI);

            // Center suit
            x.save();
            x.translate(cw / 2, ch / 2);
            x.font = `bold ${cw * 0.5}px serif`;
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.shadowColor = isRed ? 'rgba(192,0,26,0.3)' : 'rgba(0,0,0,0.3)';
            x.shadowBlur = 20;
            x.fillText(suit, 0, 0);
            x.restore();

            // Glossy sheen
            const sheen = x.createLinearGradient(0, 0, 0, ch * 0.4);
            sheen.addColorStop(0, 'rgba(255,255,255,0.15)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = sheen;
            x.fill();

            return c;
        };

        const cardVariants = [
            makeCardCanvas('K', '♦', false, 200, 280),
            makeCardCanvas('A', '♠', true, 200, 280),
            makeCardCanvas('K', '♦', true, 200, 280),
            makeCardCanvas('A', '♠', false, 200, 280)
        ];

        // --- Ambient Cards ---
        const ambientCards = Array.from({ length: 12 }, () => ({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 200,
            scale: 0.2 + Math.random() * 0.3,
            speed: 0.5 + Math.random() * 0.8,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.01,
            drift: (Math.random() - 0.5) * 0.5,
            alpha: 0.02 + Math.random() * 0.05,
            img: cardVariants[Math.floor(Math.random() * cardVariants.length)]
        }));

        // --- Collision System ---
        let startTime = Date.now();
        let particles = [];
        let shards = [];
        let sparks = [];
        let flashAlpha = 0;

        const resetCollision = () => {
            startTime = Date.now();
            shards = [];
            particles = [];
            sparks = [];
            flashAlpha = 0;
        };

        const createShards = (x, y, img) => {
            const cw = img.width;
            const ch = img.height;
            for (let i = 0; i < 55; i++) {
                const srcW = (0.04 + Math.random() * 0.14) * cw;
                const srcH = (0.04 + Math.random() * 0.14) * ch;
                const srcX = Math.random() * (cw - srcW);
                const srcY = Math.random() * (ch - srcH);
                
                // Irregular polygon for glass shape
                const pts = [];
                const numPts = 4 + Math.floor(Math.random() * 3);
                for(let p=0; p<numPts; p++){
                    pts.push({
                        x: (Math.random()-0.5) * srcW,
                        y: (Math.random()-0.5) * srcH
                    });
                }

                shards.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 20 + (img === cardVariants[0] ? -5 : 5),
                    vy: (Math.random() - 0.5) * 20 - 10,
                    rot: Math.random() * Math.PI * 2,
                    vrot: (Math.random() - 0.5) * 0.5,
                    life: 1.0,
                    gravity: 0.18 + Math.random() * 0.22,
                    srcX, srcY, srcW, srcH,
                    pts,
                    img
                });
            }
        };

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;

            // 1. Ambient Cards
            ambientCards.forEach(c => {
                c.y -= c.speed;
                c.x += c.drift;
                c.rot += c.rotSpeed;
                if (c.y < -150) {
                    c.y = canvas.height + 150;
                    c.x = Math.random() * canvas.width;
                }
                ctx.save();
                ctx.globalAlpha = c.alpha;
                ctx.translate(c.x, c.y);
                ctx.rotate(c.rot);
                ctx.scale(c.scale, c.scale);
                ctx.drawImage(c.img, -c.img.width/2, -c.img.height/2);
                ctx.restore();
            });

            // 2. Collision Animation
            // Phases: 0-2.2s Approach, 2.2s Impact, 2.2-4.7s Clear, 4.7-6s Wait
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            if (elapsed < 2.2) {
                // Approach
                const t = elapsed / 2.2;
                const ease = t * t * (3 - 2 * t); // smoothstep
                const kX = -300 + (centerX - -300) * ease;
                const aX = (canvas.width + 300) - ((canvas.width + 300) - centerX) * ease;

                [ {x: kX, img: cardVariants[0]}, {x: aX, img: cardVariants[1]} ].forEach(c => {
                    ctx.save();
                    ctx.translate(c.x, centerY);
                    ctx.rotate(c.x < centerX ? t*0.2 : -t*0.2);
                    ctx.drawImage(c.img, -c.img.width/2, -c.img.height/2);
                    ctx.restore();
                });
            } else if (elapsed < 4.7) {
                // Impact & Clear
                if (shards.length === 0) {
                    createShards(centerX, centerY, cardVariants[0]);
                    createShards(centerX, centerY, cardVariants[1]);
                    // spark streaks
                    for(let s=0; s<50; s++) sparks.push({
                        x: centerX, y: centerY,
                        vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40,
                        life: 1.0
                    });
                    // dust
                    for(let d=0; d<80; d++) particles.push({
                        x: centerX, y: centerY,
                        vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                        size: 1 + Math.random()*3, life: 1.0
                    });
                    flashAlpha = 1.0;
                }

                // Shards
                shards.forEach(s => {
                    s.vx *= 0.98;
                    s.vy += s.gravity;
                    s.x += s.vx;
                    s.y += s.vy;
                    s.rot += s.vrot;
                    s.life -= 0.005;

                    ctx.save();
                    ctx.translate(s.x, s.y);
                    ctx.rotate(s.rot);
                    ctx.globalAlpha = Math.max(0, s.life);
                    
                    // Clip to irregular shape
                    ctx.beginPath();
                    ctx.moveTo(s.pts[0].x, s.pts[0].y);
                    for(let i=1; i<s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
                    ctx.closePath();
                    ctx.clip();

                    ctx.drawImage(s.img, s.srcX, s.srcY, s.srcW, s.srcH, -s.srcW/2, -s.srcH/2, s.srcW, s.srcH);
                    
                    // Bright edge highlight
                    ctx.strokeStyle = `rgba(255,240,200,${s.life * 0.5})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.restore();
                });

                // Sparks
                sparks.forEach(s => {
                    s.x += s.vx; s.y += s.vy; s.life -= 0.02;
                    ctx.strokeStyle = `rgba(255,200,50,${s.life})`;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x - s.vx*2, s.y - s.vy*2);
                    ctx.stroke();
                });

                // Flash
                if (flashAlpha > 0) {
                    const g = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
                    g.addColorStop(0, `rgba(255,230,140,${flashAlpha*0.95})`);
                    g.addColorStop(0.3, `rgba(255,100,20,${flashAlpha*0.7})`);
                    g.addColorStop(1, `rgba(192,0,26,0)`);
                    ctx.fillStyle = g;
                    ctx.fillRect(0,0, canvas.width, canvas.height);
                    flashAlpha -= 0.05;
                }
            } else if (elapsed > 6.5) {
                resetCollision();
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return null; // Logic only
};

export default BgAnimation;
