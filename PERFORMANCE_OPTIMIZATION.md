# 🚀 Performance Optimization Guide

## ✅ Already Implemented

### 1. **React.memo on BottomNav**
- Prevents unnecessary re-renders
- Only updates when location changes

### 2. **Optimized Card Hover Animation**
- Changed from `scale` to `translateY` for better GPU performance
- Added `will-change: transform` for smoother animations

## 🔧 Quick Fixes to Apply

### 3. **Reduce Backdrop Blur**
Backdrop blur is expensive. Update these classes:

**In `BottomNav.tsx` (line 17):**
```tsx
// Change from:
bg-card/98 backdrop-blur-lg

// To:
bg-card/95 backdrop-blur-sm
```

**In `DashboardLayout.tsx` (line 150):**
```tsx
// Change from:
bg-card/95 backdrop-blur-md

// To:
bg-card/98
// Remove backdrop-blur entirely for header
```

### 4. **Optimize Animations**
Reduce animation duration for snappier feel:

**In `index.css`:**
```css
/* Change all duration-180 to duration-150 */
/* Change all duration-200 to duration-150 */
```

### 5. **Lazy Load Heavy Components**

Add to your route file:
```tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy pages
const Calendar = lazy(() => import('./pages/Calendar'));
const Reports = lazy(() => import('./pages/Reports'));
const Documents = lazy(() => import('./pages/Documents'));

// Wrap in Suspense
<Suspense fallback={<div>Loading...</div>}>
  <Calendar />
</Suspense>
```

### 6. **Debounce Search/Filter Inputs**

For any search inputs, add debouncing:
```tsx
import { useMemo, useState } from 'react';
import { debounce } from 'lodash-es'; // or create custom

const debouncedSearch = useMemo(
  () => debounce((value) => {
    // Your search logic
  }, 300),
  []
);
```

### 7. **Virtualize Long Lists**

For pages with many items (Bookings, Clients), use react-window:
```bash
npm install react-window
```

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {/* Your item component */}
    </div>
  )}
</FixedSizeList>
```

### 8. **Optimize Images**

If you have images, use lazy loading:
```tsx
<img 
  src={url} 
  loading="lazy" 
  decoding="async"
  alt="..."
/>
```

### 9. **Reduce Re-renders with useMemo/useCallback**

In components with expensive calculations:
```tsx
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 10. **Remove Unused Dependencies**

Check `package.json` and remove unused packages:
```bash
npm install depcheck -g
depcheck
```

## 🎯 Critical Performance Settings

### Enable Production Build
Always test with production build:
```bash
npm run build
npm run preview
```

### Vite Config Optimization
Add to `vite.config.ts`:
```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'recharts'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});
```

## 📊 Measure Performance

### Use React DevTools Profiler
1. Install React DevTools extension
2. Open Profiler tab
3. Record interaction
4. Identify slow components

### Use Lighthouse
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run audit
4. Fix issues with score < 90

### Check Bundle Size
```bash
npm run build
npx vite-bundle-visualizer
```

## 🚫 Performance Killers to Avoid

1. **❌ Inline Functions in JSX**
   ```tsx
   // Bad
   <Button onClick={() => handleClick(id)}>
   
   // Good
   const onClick = useCallback(() => handleClick(id), [id]);
   <Button onClick={onClick}>
   ```

2. **❌ Creating Objects/Arrays in Render**
   ```tsx
   // Bad
   <Component style={{ margin: 10 }} />
   
   // Good
   const style = { margin: 10 };
   <Component style={style} />
   ```

3. **❌ Too Many Nested Components**
   - Flatten component tree where possible
   - Use composition over deep nesting

4. **❌ Large Bundle Size**
   - Code split routes
   - Lazy load heavy components
   - Tree-shake unused code

5. **❌ Expensive Operations in Render**
   - Move to useMemo
   - Calculate outside component
   - Use web workers for heavy tasks

## 🎨 CSS Performance

### Use CSS Containment
```css
.card {
  contain: layout style paint;
}
```

### Reduce Repaints
```css
/* Use transform instead of top/left */
.animate {
  transform: translateX(100px);
  /* Not: left: 100px; */
}
```

### Optimize Shadows
```css
/* Use single shadow instead of multiple */
box-shadow: 0 4px 12px rgba(0,0,0,0.1);
/* Not: box-shadow: 0 2px 4px, 0 4px 8px, 0 8px 16px; */
```

## 🔍 Debugging Slow Performance

### Check Network Tab
- Are API calls slow?
- Too many requests?
- Large payload sizes?

### Check Performance Tab
- Long tasks (> 50ms)?
- Layout thrashing?
- Excessive repaints?

### Check Memory Tab
- Memory leaks?
- Too many DOM nodes?
- Detached DOM trees?

## 📈 Expected Results

After optimizations:
- ✅ **First Load**: < 2 seconds
- ✅ **Route Changes**: < 200ms
- ✅ **Interactions**: < 100ms
- ✅ **Smooth 60fps** animations
- ✅ **Lighthouse Score**: > 90

## 🎯 Priority Order

1. **High Priority** (Do First):
   - Remove backdrop-blur from header
   - Reduce animation durations
   - Add React.memo to heavy components
   - Production build test

2. **Medium Priority**:
   - Lazy load routes
   - Debounce search inputs
   - Optimize images
   - Code splitting

3. **Low Priority** (If still slow):
   - Virtualize lists
   - Web workers
   - Service workers
   - Advanced caching

## 💡 Quick Win Commands

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Clear cache
npm cache clean --force

# 3. Build and test
npm run build
npm run preview

# 4. Analyze bundle
npm run build
npx vite-bundle-visualizer
```

---

**Need Help?** Check each page's performance with React DevTools Profiler and focus on components that take > 16ms to render.
