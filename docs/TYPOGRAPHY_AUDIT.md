# Typography Deep Dive & Audit

## Current Font System

### Font Stack
1. **Playfair Display** (`font-serif`) - Brand/Hero/Buttons
   - Variable: `--font-playfair`
   - Usage: Landing page hero title, CTA buttons

2. **Inter** (`font-sans`) - UI/Body/Headings
   - Variable: `--font-geist-sans` (mapped to Inter)
   - Usage: Most UI text, headings, paragraphs, forms, buttons

3. **Geist Mono** (`font-mono`) - Technical Elements
   - Variable: `--font-geist-mono`
   - Usage: Addresses, amounts, hashes, labels, code

---

## Typography Usage Analysis

### Landing Page (`app/page.tsx`)

#### ✅ Correct Usage
- **Hero Title**: `font-serif` (Playfair Display) ✓
- **Buttons**: `font-serif` (Playfair Display) ✓
- **Subtitle**: `font-sans` (Inter) ✓
- **Section Headings**: `font-sans` (Inter) ✓
- **Body Text**: `font-sans` (Inter) ✓
- **Labels/Eyebrows**: `font-mono` (Geist Mono) ✓
- **Trust Line**: `font-mono` (Geist Mono) ✓

#### Tracking Values
- Hero title: `tracking-[-0.02em]` ✓
- Buttons: `tracking-[0.02em]` ✓
- Subtitle: `tracking-[-0.01em]` ✓
- Body text: `tracking-[-0.01em]` ✓
- Eyebrow labels: `tracking-[0.18em]` (section) / `tracking-[0.08em]` (mobile) ✓
- Trust line: `tracking-[0.12em]` ✓

---

### Dashboard Pages (Shield, Send, Swap, Unshield, Receive, Activity)

#### ✅ Consistent Pattern
- **Page Titles**: `font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.02em]` ✓
- **Page Descriptions**: `font-sans text-sm sm:text-base text-white/70 leading-relaxed tracking-[-0.01em]` ✓

#### ⚠️ Potential Issues
- All pages follow the same pattern, which is good
- Need to verify component-level typography consistency

---

### Navigation Components

#### Navbar (`components/navbar.tsx`)
- Mobile menu links: `font-sans` ✓
- Mobile menu numbers: `font-mono` ✓
- **Issue**: No explicit font classes on desktop nav (inherits from body)

#### Dashboard Nav (`components/dashboard-nav.tsx`)
- Nav links: `font-sans text-[11px] tracking-[0.08em] uppercase` ✓
- Mobile nav links: `font-sans text-sm tracking-[0.08em] uppercase` ✓

#### Footer (`components/footer.tsx`)
- Logo text: `font-mono text-sm tracking-widest` ⚠️ (should use specific tracking)
- Copyright: `font-mono text-xs` ✓
- Links: `font-mono text-xs` ✓
- Headings: `font-mono text-sm font-bold italic` ✓

---

### Component-Level Typography

#### Shielded Header (`components/shielded/shielded-header.tsx`)
- Section labels: `font-mono text-[11px] uppercase tracking-[0.14em] text-white/60` ✓
- Balance numbers: `font-mono` with `tracking-[-0.01em]` ✓
- Token labels: `font-sans text-sm text-white/70` ✓

#### Form Interfaces (Shield, Send, Swap, Unshield)
- Headings: `font-sans` ✓
- Form labels: `font-sans` ✓
- Input text: `font-sans` ✓
- Amounts/Addresses: `font-mono` ✓
- Helper text: `font-sans` ✓
- Buttons: `font-sans` ✓

#### Activity Page (`app/activity/page.tsx`)
- Page title: `font-sans` ✓
- Transaction amounts: `font-mono` (numbers) + `font-sans` (labels) ✓
- Status labels: `font-sans` ✓
- Timestamps: `font-sans` ✓
- Table headers: `font-mono uppercase` ✓

#### Account Modal (`components/account-modal.tsx`)
- Title: `font-sans font-semibold` ✓
- Section labels: `font-mono text-[11px] uppercase tracking-[0.14em] text-white/60` ✓
- Addresses: `font-mono` ✓
- Token symbols: `font-sans` ✓
- Token balances: `font-mono tracking-[-0.01em]` ✓

#### Help Modal (`components/help-modal.tsx`)
- Title: `font-sans font-semibold` ✓
- Questions/Answers: `font-sans text-white/70` ✓

---

## Typography Standards Summary

### Font Allocation

| Element Type | Font | Class |
|-------------|------|-------|
| **Brand/Hero** | Playfair Display | `font-serif` |
| **Buttons (Landing)** | Playfair Display | `font-serif` |
| **UI Text** | Inter | `font-sans` |
| **Headings** | Inter | `font-sans` |
| **Body/Paragraphs** | Inter | `font-sans` |
| **Forms** | Inter | `font-sans` |
| **Technical Elements** | Geist Mono | `font-mono` |
| **Addresses** | Geist Mono | `font-mono` |
| **Amounts** | Geist Mono | `font-mono` |
| **Hashes** | Geist Mono | `font-mono` |
| **Labels/Eyebrows** | Geist Mono | `font-mono` |

### Tracking (Letter Spacing) Standards

| Element | Tracking Value | Notes |
|---------|---------------|-------|
| Hero Title | `tracking-[-0.02em]` | Tight, elegant |
| Buttons | `tracking-[0.02em]` | Slight expansion |
| Body Text | `tracking-[-0.01em]` | Slightly tight |
| Page Titles | `tracking-[-0.02em]` | Match hero |
| Eyebrow Labels (Section) | `tracking-[0.18em]` | Wide, uppercase |
| Eyebrow Labels (Small) | `tracking-[0.08em]` | Medium, uppercase |
| Nav Links | `tracking-[0.08em]` | Uppercase nav |
| Trust Line | `tracking-[0.12em]` | Wide, uppercase |
| Section Labels | `tracking-[0.14em]` | Technical labels |
| Mono Numbers | `tracking-[-0.01em]` | Tight for numbers |

### Font Weight Standards

| Element | Weight | Class |
|---------|--------|-------|
| Hero Title | Normal | `font-normal` |
| Page Titles | Semibold | `font-semibold` |
| Section Headings | Light | `font-light` |
| Body Text | Normal | (default) |
| Buttons | Medium | `font-medium` |
| Active Nav | Bold | `font-bold` |
| Modal Titles | Semibold | `font-semibold` |

### Font Size Standards

| Element | Sizes | Responsive |
|---------|-------|------------|
| Hero Title | `text-5xl sm:text-6xl md:text-8xl lg:text-9xl` | ✓ |
| Page Titles | `text-3xl sm:text-4xl` | ✓ |
| Section Headings | `text-3xl sm:text-4xl md:text-6xl lg:text-7xl` | ✓ |
| Body Text | `text-sm sm:text-base` | ✓ |
| Buttons | `text-sm sm:text-base` | ✓ |
| Eyebrow Labels | `text-xs` | - |
| Section Labels | `text-[11px]` | - |
| Small Labels | `text-[10px]` | - |

---

## Issues & Inconsistencies Found

### 1. Footer Typography
- **Issue**: Uses `tracking-widest` instead of specific value
- **Location**: `components/footer.tsx:54`
- **Fix**: Change to `tracking-[0.12em]` or `tracking-[0.08em]` for consistency

### 2. Navbar Desktop Links
- **Issue**: No explicit font class (inherits from body)
- **Location**: `components/navbar.tsx` (desktop nav not shown, only mobile)
- **Status**: Desktop nav is icon-only, no text links visible

### 3. Inconsistent Tracking Values
- Some components use arbitrary tracking values
- Need to standardize to the defined tracking scale

---

## Recommendations

### 1. Create Typography Utility Classes
Consider adding to `globals.css`:
```css
@layer utilities {
  .text-hero-title {
    @apply font-serif text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-normal tracking-[-0.02em];
  }
  
  .text-page-title {
    @apply font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.02em];
  }
  
  .text-eyebrow-section {
    @apply font-mono text-xs tracking-[0.18em] uppercase;
  }
  
  .text-eyebrow-small {
    @apply font-mono text-xs tracking-[0.08em] uppercase;
  }
  
  .text-section-label {
    @apply font-mono text-[11px] uppercase tracking-[0.14em] text-white/60;
  }
  
  .text-body {
    @apply font-sans text-sm sm:text-base leading-relaxed tracking-[-0.01em];
  }
  
  .text-mono-tight {
    @apply font-mono tracking-[-0.01em];
  }
}
```

### 2. Standardize Footer
- Update footer to use consistent tracking values
- Ensure all footer text follows the mono pattern

### 3. Document Typography System
- Create a design system document
- Include examples for each typography pattern

### 4. Component Audit
- Review all components for typography consistency
- Ensure form inputs, buttons, and labels follow standards

---

## Next Steps

1. ✅ Fix footer tracking inconsistency
2. ✅ Review all components for typography compliance
3. ✅ Create typography utility classes (optional)
4. ✅ Document typography system in design docs

