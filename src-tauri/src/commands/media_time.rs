use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};

/// Accept wire-format timestamps and both raw/display EXIF timestamps.
/// EXIF values without an offset retain the existing application's UTC convention;
/// this does not infer the camera timezone.
pub(crate) fn parse_datetime(value: &str) -> Option<DateTime<Utc>> {
    if let Ok(date) = DateTime::parse_from_rfc3339(value) {
        return Some(date.with_timezone(&Utc));
    }
    [
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ]
    .iter()
    .find_map(|format| NaiveDateTime::parse_from_str(value, format).ok())
    .map(|date| Utc.from_utc_datetime(&date))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exif_and_iso_dates_represent_the_same_instant() {
        let expected = parse_datetime("2026-10-24T09:00:00Z").unwrap();
        for value in [
            "2026:10:24 09:00:00",
            "2026-10-24 09:00:00",
            "2026-10-24T09:00:00",
            "2026-10-24T12:00:00+03:00",
        ] {
            assert_eq!(parse_datetime(value), Some(expected));
        }
    }

    #[test]
    fn invalid_dates_are_not_silently_reinterpreted() {
        for value in ["", "2026:02:30 09:00:00", "not a date"] {
            assert!(parse_datetime(value).is_none());
        }
    }
}
