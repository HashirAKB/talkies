// Switch to the Active filter and rest on what is left.
export default async ({ page, demo }) => {
  await demo.click(page.getByRole('link', { name: 'Active' }));
  await page.getByTestId('todo-item').first().waitFor();
  await demo.point(page.getByTestId('todo-item').first(), 1200);
};
