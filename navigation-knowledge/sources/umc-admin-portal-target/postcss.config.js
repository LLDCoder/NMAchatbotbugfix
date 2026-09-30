/*
  postcss-pxtorem is gone.

  It used to rewrite every authored px into rem, which together with the root
  font-size set in src/main.tsx scaled the whole UI proportionally with the
  viewport. The responsive spec needs fixed values at each breakpoint, so both
  mechanisms were removed once every stylesheet had been migrated.

  Removing the two together is a no-op for anything that was never migrated: a
  px became value/16 rem, and at a 16px root that renders back as the same px.
  What changes is only that rem no longer tracks the viewport.

  The `@rwd-literal-px` directive that marked migrated files is now inert. The
  comments are harmless and are left in place rather than touched across ~300
  files in the same change that removes the plugin; strip them separately.

  See docs/responsive-migration.md.
*/
export default {
  plugins: {
    autoprefixer: {},
  },
};
