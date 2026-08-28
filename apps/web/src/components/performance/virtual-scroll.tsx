"use client";

import { cn } from "@/lib/utils";
import { calculateVisibleItems, throttle } from "@/lib/utils/performance";
import { useEffect, useMemo, useRef, useState } from "react";

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className,
  onScroll,
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { start, end } = useMemo(() => {
    return calculateVisibleItems(containerHeight, itemHeight, scrollTop, items.length, overscan);
  }, [containerHeight, itemHeight, scrollTop, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(start, end + 1).map((item, index) => ({
      item,
      index: start + index,
    }));
  }, [items, start, end]);

  const totalHeight = items.length * itemHeight;
  const offsetY = start * itemHeight;

  const handleScroll = throttle((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, 16); // ~60fps

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }} className="flex items-center">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for virtual scrolling with dynamic item heights
export function useVirtualScroll<T>({
  items,
  estimatedItemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  estimatedItemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [itemHeights, setItemHeights] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate item positions based on actual heights
  const itemPositions = useMemo(() => {
    const positions: number[] = [];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      positions[i] = totalHeight;
      totalHeight += itemHeights[i] || estimatedItemHeight;
    }

    return { positions, totalHeight };
  }, [items.length, itemHeights, estimatedItemHeight]);

  // Find visible items based on scroll position
  const visibleRange = useMemo(() => {
    const { positions, totalHeight } = itemPositions;

    let start = 0;
    let end = items.length - 1;

    // Binary search for start index
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      if (typeof position === "number" && position >= scrollTop) {
        start = Math.max(0, i - 1);
        break;
      }
    }

    // Find end index
    for (let i = start; i < positions.length; i++) {
      const position = positions[i];
      if (typeof position === "number" && position > scrollTop + containerHeight) {
        end = i;
        break;
      }
    }

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan),
      totalHeight,
    };
  }, [itemPositions, scrollTop, containerHeight, items.length, overscan]);

  const handleScroll = throttle((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, 16);

  const measureItem = (index: number, height: number) => {
    setItemHeights((prev) => {
      const newHeights = [...prev];
      newHeights[index] = height;
      return newHeights;
    });
  };

  return {
    containerRef,
    visibleRange,
    handleScroll,
    measureItem,
    scrollTop,
  };
}

// Intersection Observer based lazy loading component
interface LazyLoadProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export function LazyLoad({
  children,
  placeholder,
  rootMargin = "50px",
  threshold = 0.1,
  className,
}: LazyLoadProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.unobserve(element);
        }
      },
      {
        rootMargin,
        threshold,
      },
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold, hasLoaded]);

  return (
    <div ref={elementRef} className={className}>
      {isVisible ? children : placeholder}
    </div>
  );
}

// Optimized list component that combines virtual scrolling and lazy loading
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight: number;
  loadingPlaceholder?: React.ReactNode;
  emptyPlaceholder?: React.ReactNode;
  className?: string;
}

export function OptimizedList<T>({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight,
  loadingPlaceholder,
  emptyPlaceholder,
  className,
}: OptimizedListProps<T>) {
  if (items.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height: containerHeight }}
      >
        {emptyPlaceholder || <div className="text-muted-foreground">No items to display</div>}
      </div>
    );
  }

  // Use virtual scrolling for large lists
  if (items.length > 100) {
    return (
      <VirtualScroll
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        className={className}
      />
    );
  }

  // Use regular rendering with lazy loading for smaller lists
  return (
    <div className={cn("overflow-auto", className)} style={{ height: containerHeight }}>
      {items.map((item, index) => (
        <LazyLoad
          key={index}
          placeholder={loadingPlaceholder}
          className="min-h-[60px] flex items-center"
        >
          {renderItem(item, index)}
        </LazyLoad>
      ))}
    </div>
  );
}
