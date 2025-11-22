# Cửa Đông Care+ Pharma - Design Guidelines

## Design Approach

**Selected System**: Hybrid approach drawing from **Carbon Design System** and **Ant Design** principles  
**Rationale**: Enterprise healthcare application requiring data-dense layouts, efficient forms, and clinical reliability. These systems excel at complex information architecture and productivity workflows common in medical software.

**Key Principles**:
- Clinical clarity over visual flourish
- Information hierarchy optimized for rapid scanning
- Form efficiency to minimize data entry friction
- Consistent patterns for predictable workflows

---

## 🆕 Progress Indicators & Upload Feedback

**File Upload Progress** (Added Nov 2025):
- Real-time progress bars during file upload and AI analysis
- Multi-stage progress tracking:
  1. Upload stage (0-20%): File transfer to server
  2. Processing stage (20-60%): Content extraction from PDF/DOCX
  3. AI Analysis (60-90%): DeepSeek extraction
  4. Completion (90-100%): Data mapping
- Visual feedback includes:
  - Animated progress bar (h-2 height)
  - Stage description text
  - Percentage counter (font-mono for precision)
  - Loading spinner during active processing
  
**Implementation**:
- Component: `<Progress />` from shadcn/ui
- States tracked: `uploadProgress`, `extractionProgress`, `uploadStage`, `extractionStage`
- Smooth transitions with 1s delay before reset
- Used in: `new-case.tsx`, `FileUploadSection.tsx`

---

## Typography

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN)
- Vietnamese fallback: system-ui, -apple-system

**Hierarchy**:
- **Page Headers**: text-3xl (30px), font-semibold
- **Section Titles**: text-xl (20px), font-semibold  
- **Card Headers**: text-lg (18px), font-medium
- **Body Text**: text-base (16px), font-normal
- **Labels/Captions**: text-sm (14px), font-medium
- **Helper Text**: text-xs (12px), font-normal

**Line Height**: Use relaxed line-height (leading-relaxed) for Vietnamese text readability

---

## Layout System

**Spacing Units**: Standardize on Tailwind units of **4, 6, 8, 12, 16** (as in p-4, gap-6, mb-8, py-12, mt-16)

**Grid Structure**:
- **Sidebar Navigation**: Fixed w-64, full height, left-aligned
- **Main Content Area**: flex-1 with max-w-7xl container, px-8 py-6
- **Form Layouts**: Two-column grid (grid-cols-2) on desktop, single column on mobile
- **Data Tables**: Full-width with horizontal scroll on mobile
- **Cards**: Grid layouts using grid-cols-1 md:grid-cols-2 lg:grid-cols-3 with gap-6

**Containers**:
- Dashboard widgets: max-w-7xl with internal padding p-6
- Forms: max-w-4xl centered
- Detail views: max-w-6xl
- Modals: max-w-2xl to max-w-4xl depending on content

---

## Component Library

### Navigation
- **Sidebar**: Vertical list with icons + labels, grouped by sections (Tổng quan, Ca bệnh, Thư viện, Chat)
- **Header Bar**: Horizontal, contains user greeting "Xin chào, [username] – Cửa Đông Care+ Pharma" on left, logout button on right, h-16, border-b

### Forms & Inputs
- **Text Inputs**: h-10, rounded-md, border, px-3, full-width within columns
- **Textareas**: min-h-32, rounded-md, border, p-3
- **Select Dropdowns**: h-10, rounded-md, border, appearance-none with custom arrow
- **Labels**: mb-2, font-medium, text-sm
- **Required Indicators**: Red asterisk (*) after label
- **Field Groups**: Organize with border rounded-lg p-6 mb-6, with section heading
- **File Upload**: Dashed border area with icon, h-32, "Kéo thả hoặc click để chọn file" text

### Buttons
- **Primary Actions**: h-10, px-6, rounded-md, font-medium
- **Secondary Actions**: h-10, px-6, rounded-md, border, font-medium  
- **Icon Buttons**: h-10 w-10, rounded-md, for actions like edit/delete
- **Button Groups**: flex gap-3 for multiple actions

### Data Display
- **Tables**: Full-width, thead with font-medium, tbody with hover states, alternating row treatment, sticky header on scroll
- **Table Cells**: px-4 py-3 text-sm
- **Cards**: rounded-lg, border, p-6, shadow-sm on hover
- **Status Badges**: px-3 py-1, rounded-full, text-xs, font-medium (for eGFR levels, case status)
- **Lists**: Vertical stack with py-3 items, border-b between items

### Alerts & Notifications  
- **Warning Banners**: rounded-md, p-4, mb-6, with icon on left (for AI disclaimers like "Khuyến cáo mang tính tham khảo...")
- **Success Messages**: Toast-style, top-right, auto-dismiss after 4s
- **Error Messages**: Inline below form fields, text-sm

### Modals/Dialogs
- **Overlay**: Fixed backdrop with blur
- **Content**: Centered, rounded-lg, max-w-2xl to max-w-4xl, p-6
- **Footer**: flex justify-end gap-3 for action buttons

### Special Components
- **Chat Interface**: 
  - Left sidebar (w-80) with case selector dropdown at top
  - Right main area with messages in flex flex-col
  - Messages: max-w-3xl with different alignment for user/AI
  - Input: Fixed bottom bar, h-16, border-t
  
- **Evidence Cards**: 
  - Display as vertical list
  - Each card: border-l-4 (accent), p-4, mb-4
  - Title (font-medium) + metadata (text-sm) + summary
  - External link icon on hover

- **Medication Table (Editable)**:
  - Inline editing with text inputs in cells
  - Add row button at bottom
  - Delete icon in last column
  
- **Report Preview**:
  - White container max-w-4xl, p-8, shadow-lg
  - Print-optimized spacing
  - Header with logo placeholder + hospital info
  - Clear sections with mb-6 spacing

---

## Icons

**Library**: Heroicons (via CDN)  
**Usage**:
- Navigation items: 20x20px outline style
- Buttons: 20x20px solid style  
- Status indicators: 16x16px
- File upload areas: 32x32px outline
- Form field icons: 16x16px

**Key Icons Needed**:
- Dashboard: ChartBarIcon
- Cases: DocumentTextIcon
- Library: BookOpenIcon
- Chat: ChatBubbleLeftRightIcon
- Upload: ArrowUpTrayIcon
- Analysis: BeakerIcon
- Evidence: AcademicCapIcon
- Print: PrinterIcon
- Logout: ArrowRightOnRectangleIcon

---

## Images

This is a professional medical application - **no decorative images needed**. Focus on functional elements:

- **Hospital Logo**: Placeholder 120x60px in header and print reports
- **Empty States**: Simple icon + text (e.g., "Chưa có ca bệnh nào" with document icon)
- **File Upload Preview**: PDF/Word icons for uploaded documents

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px - stack all grids to single column, collapse sidebar to hamburger menu
- Tablet: 768px - 1024px - 2-column forms, visible sidebar with icon-only labels
- Desktop: > 1024px - full layouts as specified

**Mobile Adjustments**:
- Reduce padding to p-4
- Font sizes down one step (text-xl → text-lg)
- Tables scroll horizontally
- Fixed bottom action bars for primary CTAs

---

## Page-Specific Layouts

### /login
- Centered card (max-w-md) on blank page
- Logo/title at top, form fields stacked, full-width button

### /dashboard  
- 3-column stat cards at top (grid-cols-3, gap-6)
- Recent cases table below
- Quick action buttons in header

### /cases/new
- Left column (w-2/3): Multi-section form with field groups
- Right column (w-1/3): Sticky sidebar with upload area + AI action buttons

### /cases/:id
- Tabs navigation for sections: Thông tin, Phân tích, Bằng chứng, Phiếu tư vấn
- Full-width content area switching based on active tab

### /library
- Filter panel at top (horizontal row with dropdowns + date range)
- Results table below with pagination
- Stats cards above filters (if showing trends)

### /chat
- Persistent 2-column layout (case selector sidebar + chat area)
- No collapsing on this view

---

**Implementation Note**: Use Tailwind CSS for all styling. Keep components modular and reusable across Vietnamese medical context. Prioritize loading states for AI operations and clear error handling given critical medical nature.