'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

type Spark = {
    x: number;
    y: number;
    angle: number;
    startTime: number;
};

type ClickSparkProps = {
    sparkColor?: string;
    sparkSize?: number;
    sparkRadius?: number;
    sparkCount?: number;
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-in-out' | 'ease-out' | string;
    extraScale?: number;
    children: ReactNode;
};

export default function ClickSpark({
    sparkColor = '#fff',
    sparkSize = 10,
    sparkRadius = 15,
    sparkCount = 8,
    duration = 400,
    easing = 'ease-out',
    extraScale = 1,
    children,
}: ClickSparkProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sparksRef = useRef<Spark[]>([]);
    const animationIdRef = useRef<number | null>(null);
    const reduceMotionRef = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let resizeTimeout: number | undefined;

        const resizeCanvas = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const nextWidth = Math.max(1, Math.round(width * pixelRatio));
            const nextHeight = Math.max(1, Math.round(height * pixelRatio));

            if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
                canvas.width = nextWidth;
                canvas.height = nextHeight;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
            }
        };

        const handleResize = () => {
            if (resizeTimeout) window.clearTimeout(resizeTimeout);
            resizeTimeout = window.setTimeout(resizeCanvas, 100);
        };

        window.addEventListener('resize', handleResize, { passive: true });
        resizeCanvas();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeTimeout) window.clearTimeout(resizeTimeout);
        };
    }, []);

    const easeFunc = useCallback(
        (t: number) => {
            switch (easing) {
                case 'linear':
                    return t;
                case 'ease-in':
                    return t * t;
                case 'ease-in-out':
                    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                default:
                    return t * (2 - t);
            }
        },
        [easing]
    );

    const drawSparks = useCallback(
        function drawSparksFrame(timestamp: number) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;

            const pixelRatio = window.devicePixelRatio || 1;
            const scaledPixelRatio = Math.min(pixelRatio, 2);

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.scale(scaledPixelRatio, scaledPixelRatio);
            context.lineCap = 'round';

            sparksRef.current = sparksRef.current.filter((spark) => {
                const elapsed = timestamp - spark.startTime;
                if (elapsed >= duration) return false;

                const progress = elapsed / duration;
                const eased = easeFunc(progress);
                const distance = eased * sparkRadius * extraScale;
                const lineLength = sparkSize * (1 - eased);
                const x1 = spark.x + distance * Math.cos(spark.angle);
                const y1 = spark.y + distance * Math.sin(spark.angle);
                const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
                const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

                context.strokeStyle = sparkColor;
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(x1, y1);
                context.lineTo(x2, y2);
                context.stroke();

                return true;
            });

            context.restore();

            if (sparksRef.current.length > 0) {
                animationIdRef.current = requestAnimationFrame(drawSparksFrame);
            } else {
                animationIdRef.current = null;
            }
        },
        [duration, easeFunc, extraScale, sparkColor, sparkRadius, sparkSize]
    );

    const startAnimation = useCallback(() => {
        if (animationIdRef.current === null) {
            animationIdRef.current = requestAnimationFrame(drawSparks);
        }
    }, [drawSparks]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updateMotionPreference = () => {
            reduceMotionRef.current = motionQuery.matches;
            if (motionQuery.matches) {
                sparksRef.current = [];
                if (animationIdRef.current !== null) {
                    cancelAnimationFrame(animationIdRef.current);
                    animationIdRef.current = null;
                }
                context.clearRect(0, 0, canvas.width, canvas.height);
            }
        };

        updateMotionPreference();
        motionQuery.addEventListener('change', updateMotionPreference);

        return () => {
            motionQuery.removeEventListener('change', updateMotionPreference);
            if (animationIdRef.current !== null) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
            sparksRef.current = [];
            context.clearRect(0, 0, canvas.width, canvas.height);
        };
    }, []);

    const addSparks = useCallback(
        (x: number, y: number) => {
            if (reduceMotionRef.current) return;

            const now = performance.now();
            const newSparks = Array.from({ length: sparkCount }, (_, index) => ({
                x,
                y,
                angle: (2 * Math.PI * index) / sparkCount,
                startTime: now,
            }));
            const maxSparks = Math.max(64, sparkCount * 10);

            sparksRef.current = [...sparksRef.current, ...newSparks].slice(-maxSparks);
            startAnimation();
        },
        [sparkCount, startAnimation]
    );

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const target = event.target instanceof Element ? event.target : null;
            const action = target?.closest("a[href], button, summary, label[for], select, [role='button'], .cursor-pointer, .cursor-zoom-in, [data-cursor='zoom']");
            if (!action || action.matches(":disabled, [aria-disabled='true']")) return;
            addSparks(event.clientX, event.clientY);
        };

        window.addEventListener('pointerdown', handlePointerDown, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [addSparks]);

    return (
        <>
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-[85] block select-none"
            />
            {children}
        </>
    );
}
