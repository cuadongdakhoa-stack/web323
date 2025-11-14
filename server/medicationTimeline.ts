import type { Medication } from "@shared/schema";

export interface MedicationSegment {
  range: {
    start: Date | null;
    end: Date | null;
  };
  rangeLabel: string;
  medications: Medication[];
}

interface TimelineEvent {
  date: Date | null;
  type: 'start' | 'end';
  medication: Medication;
  isInfinity: boolean;
}

/**
 * Group medications by date overlap using sweep-line algorithm
 * Returns segments where the active medication set is stable
 * Only includes segments with 2+ medications (interaction candidates)
 */
export function groupMedicationsByDateOverlap(medications: Medication[]): MedicationSegment[] {
  if (!medications || medications.length === 0) {
    return [];
  }

  // Handle case where no medications have dates
  const medsWithDates = medications.filter(m => m.usageStartDate || m.usageEndDate);
  const medsWithoutDates = medications.filter(m => !m.usageStartDate && !m.usageEndDate);

  // If no medications have dates, return single group with all medications
  if (medsWithDates.length === 0 && medsWithoutDates.length > 1) {
    return [{
      range: { start: null, end: null },
      rangeLabel: "Ngày không rõ",
      medications: medsWithoutDates
    }];
  }

  // Create timeline events
  const events: TimelineEvent[] = [];

  for (const med of medsWithDates) {
    const startDate = med.usageStartDate ? new Date(med.usageStartDate) : null;
    const endDate = med.usageEndDate ? new Date(med.usageEndDate) : null;

    // Validate and sanitize dates
    if (startDate && endDate && endDate < startDate) {
      console.warn(`Medication ${med.drugName}: endDate < startDate, swapping dates`);
      // Swap dates
      events.push({
        date: endDate,
        type: 'start',
        medication: med,
        isInfinity: false
      });
      // Create end event at startDate + 1 day (inclusive)
      const adjustedEnd = new Date(startDate);
      adjustedEnd.setDate(adjustedEnd.getDate() + 1);
      events.push({
        date: adjustedEnd,
        type: 'end',
        medication: med,
        isInfinity: false
      });
      continue;
    }

    // Add start event (-∞ if no start date)
    events.push({
      date: startDate,
      type: 'start',
      medication: med,
      isInfinity: !startDate
    });

    // Add end event (+∞ if no end date, else endDate + 1 day for inclusive range)
    if (!endDate) {
      events.push({
        date: null,
        type: 'end',
        medication: med,
        isInfinity: true
      });
    } else {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setDate(adjustedEnd.getDate() + 1);
      events.push({
        date: adjustedEnd,
        type: 'end',
        medication: med,
        isInfinity: false
      });
    }
  }

  // Sort events: -∞ first, then by date, then +∞ last
  // Within same date: 'end' events before 'start' events (to handle adjacent ranges)
  events.sort((a, b) => {
    // Handle -∞
    if (a.isInfinity && a.type === 'start') return -1;
    if (b.isInfinity && b.type === 'start') return 1;

    // Handle +∞
    if (a.isInfinity && a.type === 'end') return 1;
    if (b.isInfinity && b.type === 'end') return -1;

    // Both have actual dates
    if (a.date && b.date) {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;

      // Same date: end before start
      if (a.type === 'end' && b.type === 'start') return -1;
      if (a.type === 'start' && b.type === 'end') return 1;
    }

    return 0;
  });

  // Group events by unique timestamp to handle same-day events correctly
  const eventsByTimestamp = new Map<number, TimelineEvent[]>();
  const uniqueTimestamps: number[] = [];
  
  for (const event of events) {
    const timestamp = event.date?.getTime() ?? (event.isInfinity && event.type === 'end' ? Infinity : -Infinity);
    
    if (!eventsByTimestamp.has(timestamp)) {
      eventsByTimestamp.set(timestamp, []);
      uniqueTimestamps.push(timestamp);
    }
    eventsByTimestamp.get(timestamp)!.push(event);
  }
  
  // Sort unique timestamps
  uniqueTimestamps.sort((a, b) => a - b);
  
  // Sweep through unique timestamps
  const segments: MedicationSegment[] = [];
  const activeMeds = new Set<Medication>();
  let prevTimestamp: number | null = null;
  let prevActiveMeds: Set<Medication> | null = null;

  for (const timestamp of uniqueTimestamps) {
    const eventsAtThisTime = eventsByTimestamp.get(timestamp)!;
    
    // If previous active set had 2+ meds and time has advanced, create segment
    if (prevActiveMeds && prevActiveMeds.size >= 2 && prevTimestamp !== null && timestamp !== prevTimestamp) {
      const segmentStart = prevTimestamp === -Infinity ? null : new Date(prevTimestamp);
      const segmentEnd = timestamp === Infinity ? null : new Date(timestamp - 24 * 60 * 60 * 1000); // Exclusive end, minus 1 day for inclusive
      
      segments.push({
        range: {
          start: segmentStart,
          end: segmentEnd
        },
        rangeLabel: formatDateRange(segmentStart, segmentEnd),
        medications: Array.from(prevActiveMeds)
      });
    }
    
    // Process all events at this timestamp
    for (const event of eventsAtThisTime) {
      if (event.type === 'start') {
        activeMeds.add(event.medication);
      } else {
        activeMeds.delete(event.medication);
      }
    }
    
    // Take snapshot for next iteration
    prevActiveMeds = new Set(activeMeds);
    prevTimestamp = timestamp;
  }
  
  // Create final segment if active set still has 2+ meds
  if (prevActiveMeds && prevActiveMeds.size >= 2 && prevTimestamp !== null) {
    const segmentStart = prevTimestamp === -Infinity ? null : new Date(prevTimestamp);
    
    segments.push({
      range: {
        start: segmentStart,
        end: null // Open-ended
      },
      rangeLabel: formatDateRange(segmentStart, null),
      medications: Array.from(prevActiveMeds)
    });
  }

  // Handle medications without dates (backward compatibility)
  if (medsWithoutDates.length > 0) {
    if (segments.length === 0) {
      // Case 1: No dated medications created segments
      // Check if we have ANY medications that could interact
      const totalMeds = medsWithDates.length + medsWithoutDates.length;
      
      if (totalMeds >= 2) {
        // Create catch-all segment with all medications
        segments.push({
          range: { start: null, end: null },
          rangeLabel: "Ngày không rõ - kiểm tra tất cả tương tác",
          medications: [...medsWithDates, ...medsWithoutDates]
        });
      }
    } else {
      // Case 2: Some dated medications created segments
      // Add undated medications to ALL dated segments (conservative: could interact anytime)
      for (const segment of segments) {
        segment.medications.push(...medsWithoutDates);
      }
      
      // Also create standalone warning segment to highlight undated meds
      if (medsWithoutDates.length >= 1) {
        segments.push({
          range: { start: null, end: null },
          rangeLabel: "CẢNH BÁO: Thuốc chưa có ngày sử dụng (cần cập nhật)",
          medications: medsWithoutDates
        });
      }
    }
  } else if (segments.length === 0 && medsWithDates.length >= 2) {
    // Case 3: All meds have dates but no overlaps found (all sequential, no parallel use)
    // Still need to check for interactions - create catch-all segment
    segments.push({
      range: { start: null, end: null },
      rangeLabel: "Thuốc dùng không chồng lấp - kiểm tra tương tác chung",
      medications: medsWithDates
    });
  }

  return segments;
}

function formatDateRange(start: Date | null, end: Date | null): string {
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!start && !end) {
    return "Ngày không rõ";
  }

  if (!start && end) {
    return `Đến ${formatDate(end)}`;
  }

  if (start && !end) {
    return `Từ ${formatDate(start)}`;
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}
