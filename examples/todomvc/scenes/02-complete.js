// Complete the first two todos; end on the counter the narration mentions.
export default async ({ page, demo }) => {
  for (const name of ['Write the scenes', 'Record a take']) {
    await demo.click(page.getByTestId('todo-item').filter({ hasText: name }).getByRole('checkbox'));
    await demo.pause(300);
  }
  await demo.point(page.getByTestId('todo-count'));
};
