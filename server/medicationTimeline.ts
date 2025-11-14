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

  // Sweep through events to build segments
  const segments: MedicationSegment[] = [];
  const activeMeds = new Set<Medication>();
  let segmentStart: Date | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const prevActiveMeds = new Set(activeMeds);

    if (event.type === 'start') {
      activeMeds.add(event.medication);
    } else {
      activeMeds.delete(event.medication);
    }

    // If active set changed and previous set had 2+ meds, create segment
    if (prevActiveMeds.size >= 2) {
      const segmentEnd = event.date;
      segments.push({
        range: {
          start: segmentStart,
          end: segmentEnd ? new Date(segmentEnd.getTime() - 24 * 60 * 60 * 1000) : null // Subtract 1 day to get inclusive end
        },
        rangeLabel: formatDateRange(segmentStart, segmentEnd ? new Date(segmentEnd.getTime() - 24 * 60 * 60 * 1000) : null),
        medications: Array.from(prevActiveMeds)
      });
    }

    // Update segment start for next iteration
    segmentStart = event.date;
  }

  // Include medications without dates in ALL segments if any
  if (medsWithoutDates.length > 0) {
    if (segments.length === 0 && medsWithoutDates.length >= 2) {
      // Only undated medications
      segments.push({
        range: { start: null, end: null },
        rangeLabel: "Ngày không rõ",
        medications: medsWithoutDates
      });
    } else {
      // Add undated medications to all existing segments
      for (const segment of segments) {
        segment.medications.push(...medsWithoutDates);
      }
    }
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
