// Small UI pieces shared by extensions. Exposed through host.js.

/** A labelled form field for a widget's Options form. */
export const Field = ({ label, children }) => (
  <label class="grid gap-1">
    <span class="text-xs">{label}</span>
    {children}
  </label>
)
