import React, { useEffect } from 'react';

const LobbyAnimation = () => {
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

        // --- Card Utility ---
        const makeCardCanvas = (label, suit, worn, cw, ch) => {
            const c = document.createElement('canvas');
            c.width = cw;
            c.height = ch;
            const x = c.getContext('2d');
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
            x.strokeStyle = 'rgba(180,140,50,0.9)';
            x.lineWidth = cw * 0.025;
            x.stroke();
            const pad = cw * 0.05;
            x.strokeStyle = 'rgba(180,140,50,0.4)';
            x.lineWidth = 1;
            x.strokeRect(pad, pad, cw - pad * 2, ch - pad * 2);
            const isRed = (suit === '♦' || suit === '♥');
            x.fillStyle = isRed ? '#c0001a' : '#111';
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
            x.save();
            x.translate(cw / 2, ch / 2);
            x.font = `bold ${cw * 0.5}px serif`;
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillText(suit, 0, 0);
            x.restore();
            const sheen = x.createLinearGradient(0, 0, 0, ch * 0.4);
            sheen.addColorStop(0, 'rgba(255,255,255,0.15)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = sheen;
            x.fill();
            return c;
        };

        const cardPool = [
            { label: 'K', suit: '♦', worn: false },
            { label: 'A', suit: '♠', worn: true },
            { label: 'Q', suit: '♥', worn: false },
            { label: 'J', suit: '♣', worn: true },
            { label: '10', suit: '♦', worn: false }
        ].map(p => makeCardCanvas(p.label, p.suit, p.worn, 140, 196));

        // --- Layers Setup ---
        
        // Light Rays (5)
        const rays = Array.from({ length: 5 }, () => ({
            x: Math.random() * canvas.width,
            width: 40 + Math.random() * 80,
            phase: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.02
        }));

        // Falling Cards (28)
        const fallingCards = Array.from({ length: 28 }, () => {
            const w = 55 + Math.random() * 85;
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w,
                h: w * 1.4,
                vy: 0.4 + Math.random() * 1.0,
                vx: (Math.random() - 0.5) * 0.3,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 0.01,
                alpha: 0.06 + Math.random() * 0.16,
                img: cardPool[Math.floor(Math.random() * cardPool.length)]
            };
        });

        // Floating Diamonds (25)
        const diamonds = Array.from({ length: 25 }, () => ({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 100,
            size: 10 + Math.random() * 22,
            vy: 0.3 + Math.random() * 0.6,
            alpha: 0.04 + Math.random() * 0.1,
            color: Math.random() > 0.5 ? 'rgba(201,168,76,' : 'rgba(192,0,26,'
        }));

        // Embers (120)
        const embers = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: canvas.height * 0.5 + Math.random() * canvas.height * 0.5,
            r: 1 + Math.random() * 2.5,
            vy: 0.8 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2,
            color: Math.random() > 0.5 ? 'rgba(201,168,76,0.7)' : 'rgba(192,0,26,0.7)'
        }));

        const loop = () => {
            // Layer 1 - BASE
            ctx.fillStyle = '#060300';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const W = canvas.width;
            const H = canvas.height;

            // Layer 2 - FIRE GLOW
            const fireGrd = ctx.createRadialGradient(W/2, H, 0, W/2, H, W * 0.8);
            fireGrd.addColorStop(0, 'rgba(120,10,5,0.35)');
            fireGrd.addColorStop(0.4, 'rgba(80,5,3,0.15)');
            fireGrd.addColorStop(1, 'transparent');
            ctx.fillStyle = fireGrd;
            ctx.fillRect(0, 0, W, H);

            // Layer 3 - WARM CENTER GLOW
            const centerGrd = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W * 0.6);
            centerGrd.addColorStop(0, 'rgba(80,40,8,0.3)');
            centerGrd.addColorStop(0.5, 'rgba(50,15,5,0.15)');
            centerGrd.addColorStop(1, 'transparent');
            ctx.fillStyle = centerGrd;
            ctx.fillRect(0, 0, W, H);

            // Layer 4 - LIGHT RAYS
            rays.forEach(r => {
                r.phase += r.speed;
                const alpha = 0.015 + (Math.sin(r.phase) + 1) * 0.5 * 0.03;
                ctx.save();
                ctx.globalAlpha = alpha;
                const rayGrd = ctx.createLinearGradient(0, 0, 0, H);
                rayGrd.addColorStop(0, 'rgba(201,168,76,0)');
                rayGrd.addColorStop(0.4, 'rgba(201,168,76,0.8)');
                rayGrd.addColorStop(0.7, 'rgba(192,0,26,0.4)');
                rayGrd.addColorStop(1, 'transparent');
                ctx.fillStyle = rayGrd;

                ctx.beginPath();
                ctx.moveTo(r.x, 0);
                ctx.lineTo(r.x + r.width * 0.2, 0);
                ctx.lineTo(r.x + r.width, H);
                ctx.lineTo(r.x - r.width * 0.5, H);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });

            // Layer 5 - FALLING CARDS
            fallingCards.forEach(c => {
                c.y += c.vy;
                c.x += c.vx;
                c.rot += c.vrot;
                if (c.y > H + 200) {
                    c.y = -200;
                    c.x = Math.random() * W;
                }
                ctx.save();
                ctx.globalAlpha = c.alpha;
                ctx.translate(c.x, c.y);
                ctx.rotate(c.rot);
                ctx.drawImage(c.img, -c.w/2, -c.h/2, c.w, c.h);
                ctx.restore();
            });

            // Layer 6 - FLOATING DIAMONDS
            diamonds.forEach(d => {
                d.y -= d.vy;
                if (d.y < -50) {
                    d.y = H + 50;
                    d.x = Math.random() * W;
                }
                ctx.save();
                ctx.font = `${d.size}px serif`;
                ctx.fillStyle = d.color + d.alpha + ')';
                ctx.shadowBlur = d.size * 0.5;
                ctx.shadowColor = d.color.includes('201') ? 'rgba(201,168,76,0.5)' : 'rgba(192,0,26,0.5)';
                ctx.textAlign = 'center';
                ctx.fillText('♦', d.x, d.y);
                ctx.restore();
            });

            // Layer 7 - EMBERS
            embers.forEach(e => {
                e.y -= e.vy;
                e.phase += 0.02;
                const dx = Math.sin(e.phase) * 1.5;
                if (e.y < -20) {
                    e.y = H + 20;
                    e.x = Math.random() * W;
                }
                ctx.save();
                ctx.beginPath();
                ctx.arc(e.x + dx, e.y, e.r, 0, Math.PI * 2);
                ctx.fillStyle = e.color;
                ctx.shadowBlur = 5;
                ctx.shadowColor = e.color;
                ctx.fill();
                ctx.restore();
            });

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return null;
};

export default LobbyAnimation;
