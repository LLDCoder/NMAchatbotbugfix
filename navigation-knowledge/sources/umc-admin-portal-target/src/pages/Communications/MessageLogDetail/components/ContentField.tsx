export default function ContentField({
  label,
  value,
  multiline = false,
  direction = "ltr",
}: {
  label: string;
  value: string;
  multiline?: boolean;
  direction?: "ltr" | "rtl";
}) {
  if (multiline) {
    return (
      <div className="message-content-field is-multiline">
        <div className="message-content-field__heading">{label}</div>
        <div className="message-content-value" dir={direction}>
          {value}
        </div>
      </div>
    );
  }
  return (
    <div className="message-content-field">
      <span>{label}</span>
      <div className="message-content-value" dir={direction}>
        {value}
      </div>
    </div>
  );
}
