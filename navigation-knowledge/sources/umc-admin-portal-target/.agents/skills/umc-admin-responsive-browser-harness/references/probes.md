# Responsive Browser Probes

Use these functions with Playwright CLI `run-code` after the page has settled. Keep interactions ref-based; these snippets are only for deterministic measurements.

## Page and All Registered Toolbars Probe

```js
async page => {
  const result = await page.evaluate(() => {
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }
    }

    const toolbars = [
      ...document.querySelectorAll(
        ".filter-table-header, .responsive-filter-toolbar"
      ),
    ].map((toolbar, index) => {
      const filterGroup = toolbar.querySelector(
        ".header-filter, .responsive-filter-toolbar__controls"
      )
      const action = toolbar.querySelector(
        ".header-extra-btn, .responsive-filter-toolbar__action"
      )
      const panel =
        toolbar.closest(".filter-table, .ant-card, .table-panel") ||
        toolbar.parentElement
      const toolbarBox = toolbar.getBoundingClientRect()
      const panelBox = panel?.getBoundingClientRect()
      const searches = [
        ...toolbar.querySelectorAll(".ant-input-affix-wrapper"),
      ].map(search => {
        const prefixBox = search
          .querySelector(".ant-input-prefix")
          ?.getBoundingClientRect()
        const inputBox = search.querySelector("input")?.getBoundingClientRect()
        return {
          sameRow:
            !prefixBox ||
            !inputBox ||
            Math.abs(
              prefixBox.top +
                prefixBox.height / 2 -
                (inputBox.top + inputBox.height / 2),
            ) <= 1,
          centerDelta:
            prefixBox && inputBox
              ? Math.abs(
                  prefixBox.top +
                    prefixBox.height / 2 -
                    (inputBox.top + inputBox.height / 2),
                )
              : null,
        }
      })

      return {
        index,
        className: toolbar.className,
        toolbar: rect(toolbar),
        filterGroup: rect(filterGroup),
        action: rect(action),
        inlineChildren: filterGroup?.children.length ?? 0,
        searches,
        withinPanel:
          !panelBox ||
          (toolbarBox.left >= panelBox.left - 1 &&
            toolbarBox.right <= panelBox.right + 1),
        actions: action
          ? [...action.querySelectorAll("button, a")]
              .filter(element => element.getClientRects().length)
              .map(element => element.textContent?.trim() || "")
          : [],
      }
    })

    return {
      url: location.pathname + location.search,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      toolbars,
    }
  })

  if (result.documentOverflow > 1) {
    throw new Error(`Document overflow: ${result.documentOverflow}px`)
  }
  if (result.toolbars.some(toolbar => !toolbar.withinPanel)) {
    throw new Error(
      `Toolbar crosses panel boundary: ${JSON.stringify(result.toolbars)}`
    )
  }
  if (
    result.toolbars.some(toolbar =>
      toolbar.searches.some(search => !search.sameRow),
    )
  ) {
    throw new Error(
      `Affix search content is not centered: ${JSON.stringify(result.toolbars)}`,
    )
  }

  return result
}
```

## All Toolbar Action Rows and Table Gaps Probe

```js
async page => {
  return await page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll(
        ".filter-table-header, .responsive-filter-toolbar"
      ),
    ].map((toolbar, index) => {
      const control = toolbar.querySelector(
        ".header-filter > :first-child, " +
        ".responsive-filter-toolbar__field:first-child"
      )
      const action = toolbar.querySelector(
        ".header-extra-btn, .responsive-filter-toolbar__action"
      )
      const controlBox = control?.getBoundingClientRect()
      const actionBox = action?.getBoundingClientRect()
      const actionRowDelta =
        controlBox && actionBox ? Math.abs(actionBox.top - controlBox.top) : null
      const visibleControlHeights = [
        ...toolbar.querySelectorAll(
          ".ant-input-affix-wrapper, .ant-picker, " +
          ".ant-select-selector, button"
        ),
      ]
        .filter(element => element.getClientRects().length)
        .map(element => Math.round(element.getBoundingClientRect().height))
      const expectedControlHeight = innerWidth < 1920 ? 40 : 48

      let tableGap = null
      if (toolbar.matches(".responsive-filter-toolbar")) {
        const owner = toolbar.parentElement
        const table = owner?.querySelector(
          ":scope > .ant-table-wrapper, :scope > .table-panel"
        )
        const tableBox = table?.getBoundingClientRect()
        const toolbarBox = toolbar.getBoundingClientRect()
        if (tableBox) tableGap = Math.round(tableBox.top - toolbarBox.bottom)
      }

      return {
        index,
        actionRowDelta,
        tableGap,
        expectedControlHeight,
        visibleControlHeights,
      }
    })

    const badAction = rows.find(
      row => row.actionRowDelta !== null && row.actionRowDelta > 1
    )
    if (badAction) {
      throw new Error(
        `Toolbar action row delta: ${JSON.stringify(badAction)}`
      )
    }
    const badGap = rows.find(
      row => row.tableGap !== null && row.tableGap !== 12
    )
    if (badGap) {
      throw new Error(`Toolbar/table gap: ${JSON.stringify(badGap)}`)
    }
    const badHeight = rows.find(row =>
      row.visibleControlHeights.some(
        height => height !== row.expectedControlHeight
      )
    )
    if (badHeight) {
      throw new Error(
        `Toolbar control height: ${JSON.stringify(badHeight)}`
      )
    }

    return rows
  })
}
```

## Filter Modal Probe

Run after opening the Filter modal and waiting for its animation to finish.

```js
async page => {
  // Populate this with the expected semantic i18n values for the active state
  // and locale. Do not derive it from placeholder text.
  const expectedLabels = []
  // Set this to 0 only when the current snapshot proves that every
  // placeholder-capable control already has a selected value.
  const expectedPlaceholderMinimum = 1
  await page.waitForSelector(".filter-modal")
  await page.waitForTimeout(350)

  const result = await page.evaluate(() => {
    const itemCount = document.querySelectorAll(
      ".filter-modal .filter-modal-item"
    ).length
    const labels = [...document.querySelectorAll(".filter-modal-item-label")]
      .map(element => element.textContent?.trim() || "")
    const placeholders = [
      ...document.querySelectorAll(".filter-modal .filter-modal-item"),
    ].map(item =>
      item.querySelector(".ant-select-selection-placeholder")
        ?.textContent?.trim() ||
      item.querySelector("input[placeholder]")?.getAttribute("placeholder") ||
      ""
    )

    const selectPlaceholders = [
      ...document.querySelectorAll(
        ".filter-modal .ant-select-selection-placeholder"
      ),
    ].map(element => {
      const style = getComputedStyle(element)
      return {
        text: element.textContent?.trim() || "",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
      }
    })

    const rangePlaceholders = [
      ...document.querySelectorAll(".filter-modal .ant-picker-input > input"),
    ]
      .filter(element => element.placeholder)
      .map(element => {
        const style = getComputedStyle(element, "::placeholder")
        return {
          text: element.placeholder,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
        }
      })

    const headerBox = document
      .querySelector(".filter-modal .ant-modal-header")
      ?.getBoundingClientRect()
    const closeBox = document
      .querySelector(".filter-modal .ant-modal-close-x svg")
      ?.getBoundingClientRect()
    const centerDelta =
      headerBox && closeBox
        ? Math.abs(
            headerBox.top +
              headerBox.height / 2 -
              (closeBox.top + closeBox.height / 2)
          )
        : null
    const itemVerticalExcess = [
      ...document.querySelectorAll(".filter-modal .filter-modal-item"),
    ].map(item => {
      const label = item.querySelector(".filter-modal-item-label")
      const control = item.querySelector(
        ".ant-input-affix-wrapper, .ant-input, .ant-picker, .ant-select"
      )
      if (!label || !control) return 0
      const itemBox = item.getBoundingClientRect()
      const labelBox = label.getBoundingClientRect()
      const controlBox = control.getBoundingClientRect()
      const gap = parseFloat(getComputedStyle(item).rowGap || "0")
      return Math.max(
        0,
        itemBox.height - labelBox.height - controlBox.height - gap,
      )
    })
    const content = document.querySelector(".filter-modal-content")
    const contentStyle = content ? getComputedStyle(content) : null
    const columnWidths = contentStyle?.gridTemplateColumns
      .split(" ")
      .map(value => parseFloat(value))
      .filter(Number.isFinite) || []
    const itemWidths = [
      ...document.querySelectorAll(".filter-modal .filter-modal-item"),
    ].map(item => item.getBoundingClientRect().width)

    return {
      documentLang: document.documentElement.lang,
      itemCount,
      labels,
      placeholders,
      selectPlaceholders,
      rangePlaceholders,
      centerDelta,
      itemVerticalExcess,
      columnWidths,
      itemWidths,
    }
  })

  if (
    result.itemCount === 0 ||
    result.labels.length !== result.itemCount ||
    result.labels.some(label => !label)
  ) {
    throw new Error(
      `Missing modal label: ${result.labels.length}/${result.itemCount} ` +
      JSON.stringify(result.labels)
    )
  }
  if (
    expectedLabels.length &&
    JSON.stringify(result.labels) !== JSON.stringify(expectedLabels)
  ) {
    throw new Error(
      `Unexpected modal labels: ${JSON.stringify(result.labels)}`
    )
  }
  const invalidSemanticLabels = result.labels.filter(
    (label, index) =>
      /^(All|Select)\b/i.test(label) ||
      (result.placeholders[index] &&
        label === result.placeholders[index])
  )
  if (invalidSemanticLabels.length) {
    throw new Error(
      "Placeholder text used as modal label: " +
      JSON.stringify(invalidSemanticLabels)
    )
  }
  const englishTitleCaseErrors = result.documentLang
    ?.toLowerCase()
    .startsWith("en")
    ? [...result.labels, ...result.placeholders]
        .filter(Boolean)
        .filter(text => /^(All|Select|Start|End)\s+[a-z]/.test(text))
    : []
  if (englishTitleCaseErrors.length) {
    throw new Error(
      "English filter text is not Title Case: " +
      JSON.stringify(englishTitleCaseErrors)
    )
  }
  if (result.centerDelta === null || result.centerDelta > 1) {
    throw new Error(`Close icon center delta: ${result.centerDelta}`)
  }
  if (result.itemVerticalExcess.some(excess => excess > 1)) {
    throw new Error(
      `Unexpected modal row space: ${JSON.stringify(result.itemVerticalExcess)}`
    )
  }
  if (
    result.columnWidths.length === 2 &&
    result.itemWidths.some(
      width => Math.abs(width - result.columnWidths[0]) > 1
    )
  ) {
    throw new Error(
      `Modal item spans multiple columns: ${JSON.stringify({
        columnWidths: result.columnWidths,
        itemWidths: result.itemWidths,
      })}`
    )
  }

  const typography = [
    ...result.selectPlaceholders,
    ...result.rangePlaceholders,
  ].map(({ fontFamily, fontSize, fontWeight, color }) =>
    JSON.stringify({ fontFamily, fontSize, fontWeight, color })
  )
  const placeholderControlCount = await page
    .locator(
      ".filter-modal .ant-select-selection-placeholder, " +
      ".filter-modal .ant-picker-input > input[placeholder]"
    )
    .count()
  if (
    placeholderControlCount < expectedPlaceholderMinimum ||
    typography.length !== placeholderControlCount
  ) {
    throw new Error(
      `Placeholder measurement mismatch: ${typography.length}/` +
      `${placeholderControlCount}, expected at least ` +
      expectedPlaceholderMinimum
    )
  }
  if (new Set(typography).size > 1) {
    throw new Error(`Placeholder typography mismatch: ${typography.join(" | ")}`)
  }

  return result
}
```

If a route has only Select or only RangePicker placeholders, record the available styles and compare them with the project contract instead of manufacturing a cross-control comparison.
